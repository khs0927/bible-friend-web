import { getStore } from "@netlify/blobs";

const SPACE = "https://funaudiollm-fun-cosyvoice3-0-5b.hf.space";
const samples: Record<string, { text: string; instruct: string }> = {
  love: {
    text: "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계셔.",
    instruct: "You are a helpful assistant. Please speak in natural Korean with warm, gentle, sweet affection, a soft smile, and sincere caring emotion. Keep the original speaker identity from the reference audio. Do not sound theatrical or childish.<|endofprompt|>",
  },
  comfort: {
    text: "괜찮아. 천천히 이야기해 줘. 성경 친구가 함께 들어줄게.",
    instruct: "You are a helpful assistant. Please speak in natural Korean as if calmly comforting a worried child. Use a warm reassuring tone, slightly slower pace, genuine empathy, and keep the original speaker identity from the reference audio.<|endofprompt|>",
  },
  joy: {
    text: "우와, 정말 잘했어! 오늘도 하나님의 말씀을 함께 알아보자.",
    instruct: "You are a helpful assistant. Please speak in natural Korean with genuine bright joy, an audible smile, warm encouragement, and lively energy without exaggeration. Keep the original speaker identity from the reference audio.<|endofprompt|>",
  },
};

const validId = (value: string) => /^[0-9a-f-]{30,50}$/i.test(value);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const store = () => getStore("bible-friend-voice-lab", { consistency: "strong" });

async function fetchRetry(url: string, init: RequestInit = {}, tries = 4) {
  let last: unknown;
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url, init);
      if (![429, 502, 503, 504].includes(response.status)) return response;
      last = new Error(`HTTP ${response.status}`);
    } catch (error) {
      last = error;
    }
    await wait(3000 * (i + 1));
  }
  throw last instanceof Error ? last : new Error("network retry exhausted");
}

function fileData(path: string) {
  return {
    path,
    url: `${SPACE}/gradio_api/file=${encodeURIComponent(path)}`,
    orig_name: "bible-friend-reference.wav",
    mime_type: "audio/wav",
    meta: { _type: "gradio.FileData" },
  };
}

async function gradioCall(name: string, data: unknown[]) {
  const start = await fetchRetry(`${SPACE}/gradio_api/call/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!start.ok) throw new Error(`${name} start ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const begun = await start.json() as { event_id?: string };
  if (!begun.event_id) throw new Error(`${name}: no event_id`);

  const result = await fetchRetry(`${SPACE}/gradio_api/call/${name}/${encodeURIComponent(begun.event_id)}`, {
    headers: { accept: "text/event-stream" },
  }, 2);
  if (!result.ok) throw new Error(`${name} result ${result.status}: ${(await result.text()).slice(0, 300)}`);

  const sse = await result.text();
  const values: unknown[] = [];
  let eventName = "";
  for (const line of sse.split(/\r?\n/)) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (eventName === "error") throw new Error(`${name} generation: ${raw}`);
    if (!raw) continue;
    try { values.push(JSON.parse(raw)); } catch {}
  }
  if (!values.length) throw new Error(`${name}: empty result`);
  return values.at(-1);
}

function getAudioUrl(value: any): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") return /^https?:\/\//i.test(first) ? first : `${SPACE}/${first.replace(/^\//, "")}`;
  const candidate = first?.url ?? first?.data?.url ?? first?.path ?? first?.data?.path;
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return `${SPACE}/${String(candidate).replace(/^\//, "")}`;
}

export default async (req: Request) => {
  let jobId = "";
  const db = store();
  try {
    const form = await req.formData();
    jobId = String(form.get("jobId") ?? "");
    const sampleKey = String(form.get("sample") ?? "");
    const reference = form.get("reference");

    if (!validId(jobId)) throw new Error("invalid job id");
    if (!samples[sampleKey]) throw new Error("invalid sample");
    if (!(reference instanceof File)) throw new Error("reference WAV missing");
    if (reference.size > 5_000_000) throw new Error("reference file too large");

    await db.setJSON(`jobs/${jobId}.json`, {
      status: "running",
      sample: sampleKey,
      message: "레퍼런스를 CosyVoice3에 업로드 중…",
      startedAt: new Date().toISOString(),
    });

    const referenceBytes = await reference.arrayBuffer();
    const uploadForm = new FormData();
    uploadForm.append("files", new Blob([referenceBytes], { type: "audio/wav" }), "bible-friend-reference.wav");
    const upload = await fetchRetry(`${SPACE}/gradio_api/upload`, { method: "POST", body: uploadForm });
    if (!upload.ok) throw new Error(`reference upload ${upload.status}: ${(await upload.text()).slice(0, 300)}`);
    const uploadBody = await upload.json() as any;
    const path = Array.isArray(uploadBody) ? uploadBody[0] : uploadBody?.files?.[0] ?? uploadBody?.path;
    if (!path) throw new Error("reference upload response missing path");

    await db.setJSON(`jobs/${jobId}.json`, {
      status: "running",
      sample: sampleKey,
      message: "CosyVoice3 ZeroGPU에서 음성을 생성 중…",
      startedAt: new Date().toISOString(),
    });

    const sample = samples[sampleKey];
    const output = await gradioCall("generate_audio", [
      sample.text,
      "instruct",
      "",
      fileData(path),
      null,
      sample.instruct,
      20260823,
      false,
      "En",
    ]);
    const audioUrl = getAudioUrl(output);
    if (!audioUrl) throw new Error("generated audio URL missing");

    const audioResponse = await fetchRetry(audioUrl, {}, 3);
    if (!audioResponse.ok) throw new Error(`audio download ${audioResponse.status}`);
    const audioBytes = await audioResponse.arrayBuffer();
    await db.set(`audio/${jobId}.wav`, audioBytes);
    await db.setJSON(`jobs/${jobId}.json`, {
      status: "done",
      sample: sampleKey,
      text: sample.text,
      bytes: audioBytes.byteLength,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (validId(jobId)) {
      await db.setJSON(`jobs/${jobId}.json`, { status: "error", error: message, finishedAt: new Date().toISOString() });
    }
    console.error("CosyVoice background error", error);
  }
};
