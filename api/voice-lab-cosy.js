const HF_SPACE = "https://funaudiollm-fun-cosyvoice3-0-5b.hf.space";
const REFERENCE_URL = "https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/asset/zero_shot_prompt.wav";

const SAMPLES = {
  love: {
    text: "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계셔.",
    instruct: "You are a helpful assistant. Please say a sentence in a very soft voice.<|endofprompt|>",
  },
  comfort: {
    text: "괜찮아. 천천히 이야기해 줘. 성경 친구가 함께 들어줄게.",
    instruct: "You are a helpful assistant. 请用尽可能慢地语速说一句话。<|endofprompt|>",
  },
  joy: {
    text: "우와, 정말 잘했어! 오늘도 하나님의 말씀을 함께 알아보자.",
    instruct: "You are a helpful assistant. 请非常开心地说一句话。<|endofprompt|>",
  },
};

async function fetchReference() {
  const r = await fetch(REFERENCE_URL, { redirect: "follow" });
  if (!r.ok) throw new Error(`reference_http_${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function gradioUpload(wav) {
  const form = new FormData();
  form.append("files", new Blob([wav], { type: "audio/wav" }), "cosyvoice-reference.wav");
  const r = await fetch(`${HF_SPACE}/gradio_api/upload`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`gradio_upload_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  const body = await r.json();
  const path = Array.isArray(body) ? body[0] : body?.files?.[0] ?? body?.path;
  if (!path) throw new Error(`gradio_upload_bad_response:${JSON.stringify(body).slice(0, 300)}`);
  return path;
}

function fileData(path) {
  return {
    path,
    url: `${HF_SPACE}/gradio_api/file=${encodeURIComponent(path)}`,
    orig_name: path.split("/").pop() || "cosyvoice-reference.wav",
    mime_type: "audio/wav",
    meta: { _type: "gradio.FileData" },
  };
}

async function generate(uploadedPath, sample, seed) {
  const start = await fetch(`${HF_SPACE}/gradio_api/call/generate_audio`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      data: [sample.text, "instruct", "", fileData(uploadedPath), null, sample.instruct, seed, false, "En"],
    }),
  });
  if (!start.ok) throw new Error(`gradio_call_http_${start.status}:${(await start.text()).slice(0, 500)}`);
  const started = await start.json();
  if (!started?.event_id) throw new Error(`gradio_call_bad_response:${JSON.stringify(started).slice(0, 500)}`);

  const result = await fetch(`${HF_SPACE}/gradio_api/call/generate_audio/${encodeURIComponent(started.event_id)}`, {
    headers: { accept: "text/event-stream" },
  });
  if (!result.ok) throw new Error(`gradio_result_http_${result.status}:${(await result.text()).slice(0, 500)}`);
  const sse = await result.text();
  const events = [];
  let currentEvent = "";
  for (const line of sse.split(/\r?\n/)) {
    if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (currentEvent === "error") throw new Error(`gradio_generation_error:${raw}`);
    if (!raw) continue;
    try { events.push(JSON.parse(raw)); } catch {}
  }
  const last = events.at(-1);
  const first = Array.isArray(last) ? last[0] : last;
  const audioUrl = typeof first === "string" ? first : first?.url ?? first?.data?.url ?? null;
  if (!audioUrl) throw new Error(`gradio_output_unrecognised:${sse.slice(-1000)}`);
  return audioUrl;
}

async function makeOne(key, uploadedPath, index) {
  const sample = SAMPLES[key];
  const startedAt = Date.now();
  try {
    const audioUrl = await generate(uploadedPath, sample, 20260823 + index);
    return { ok: true, sample: key, text: sample.text, instruct: sample.instruct, audioUrl, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, sample: key, text: sample.text, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  const requested = String(req.query?.sample ?? "all");
  const keys = requested === "all" ? ["love", "comfort", "joy"] : [requested];
  if (keys.some((key) => !SAMPLES[key])) {
    return res.status(400).json({ ok: false, error: "sample must be all, love, comfort, or joy" });
  }

  const startedAt = Date.now();
  try {
    const reference = await fetchReference();
    const uploadedPath = await gradioUpload(reference);
    const outputs = await Promise.all(keys.map((key, index) => makeOne(key, uploadedPath, index)));
    return res.status(outputs.every((item) => item.ok) ? 200 : 207).json({
      ok: outputs.every((item) => item.ok),
      model: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
      inferenceMode: "instruct",
      outputs,
      reference: { source: "FunAudioLLM/CosyVoice asset/zero_shot_prompt.wav", purpose: "transport probe only" },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt });
  }
}
