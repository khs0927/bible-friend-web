const HF_SPACE = "https://funaudiollm-fun-cosyvoice3-0-5b.hf.space";
const REFERENCE_URL = "https://huggingface.co/datasets/humyn-labs/korean-voice-emotion-dataset/resolve/main/Young_Female1_Happy.wav?download=true";

const SAMPLES = {
  love: {
    text: "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계셔.",
    instruct: "한국어로 말해. 어린아이에게 진심으로 사랑을 전하는 젊은 여성 성경 친구처럼 밝고 따뜻하고 다정하게 말해. 은은한 미소와 포근함이 느껴지게 하되 유아 말투나 과장은 피하고 자연스럽게 말해.",
  },
  comfort: {
    text: "괜찮아. 천천히 이야기해 줘. 성경 친구가 함께 들어줄게.",
    instruct: "한국어로 말해. 속상한 아이를 안심시키는 젊은 여성 성경 친구처럼 부드럽고 차분하고 공감하는 목소리로 말해. 조금 천천히, 따뜻한 호흡과 위로가 느껴지되 우울하게 처지지 않게 말해.",
  },
  joy: {
    text: "우와, 정말 잘했어! 오늘도 하나님의 말씀을 함께 알아보자.",
    instruct: "한국어로 말해. 아이를 진심으로 칭찬하는 젊은 여성 성경 친구처럼 밝고 기쁘고 생기 있게 말해. 미소가 자연스럽게 느껴지고 즐거운 에너지가 있으나 만화 같은 과장은 피해서 말해.",
  },
};

function readUInt32LE(buf, off) {
  return buf.readUInt32LE(off);
}

function trimPcmWav(input, maxSeconds = 8.0) {
  if (input.subarray(0, 4).toString("ascii") !== "RIFF" || input.subarray(8, 12).toString("ascii") !== "WAVE") {
    return input;
  }
  let off = 12;
  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= input.length) {
    const id = input.subarray(off, off + 4).toString("ascii");
    const len = readUInt32LE(input, off + 4);
    const body = off + 8;
    if (id === "fmt " && len >= 16) {
      fmt = {
        audioFormat: input.readUInt16LE(body),
        channels: input.readUInt16LE(body + 2),
        sampleRate: input.readUInt32LE(body + 4),
        byteRate: input.readUInt32LE(body + 8),
        blockAlign: input.readUInt16LE(body + 12),
        bitsPerSample: input.readUInt16LE(body + 14),
      };
    }
    if (id === "data") {
      dataOff = body;
      dataLen = Math.min(len, input.length - body);
      break;
    }
    off = body + len + (len % 2);
  }
  if (!fmt || fmt.audioFormat !== 1 || dataOff < 0 || !fmt.byteRate) return input;
  const maxBytesRaw = Math.floor(fmt.byteRate * maxSeconds);
  const maxBytes = Math.floor(maxBytesRaw / fmt.blockAlign) * fmt.blockAlign;
  if (dataLen <= maxBytes) return input;
  const pcm = input.subarray(dataOff, dataOff + maxBytes);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(fmt.audioFormat, 20);
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(fmt.byteRate, 28);
  header.writeUInt16LE(fmt.blockAlign, 32);
  header.writeUInt16LE(fmt.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function fetchReference() {
  const r = await fetch(REFERENCE_URL, { redirect: "follow" });
  if (!r.ok) throw new Error(`reference_http_${r.status}`);
  const raw = Buffer.from(await r.arrayBuffer());
  return trimPcmWav(raw, 8.0);
}

async function gradioUpload(wav) {
  const form = new FormData();
  form.append("files", new Blob([wav], { type: "audio/wav" }), "bible-friend-reference.wav");
  const r = await fetch(`${HF_SPACE}/gradio_api/upload`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`gradio_upload_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  const body = await r.json();
  const path = Array.isArray(body) ? body[0] : body?.files?.[0] ?? body?.path;
  if (!path) throw new Error(`gradio_upload_bad_response:${JSON.stringify(body).slice(0, 300)}`);
  return path;
}

function fileData(path) {
  return { path, meta: { _type: "gradio.FileData" } };
}

async function startGeneration(uploadedPath, sample) {
  const payload = {
    data: [
      sample.text,
      "instruct",
      "",
      fileData(uploadedPath),
      null,
      sample.instruct,
      20260823,
      false,
      "En",
    ],
  };
  const r = await fetch(`${HF_SPACE}/gradio_api/call/generate_audio`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`gradio_call_http_${r.status}:${(await r.text()).slice(0, 500)}`);
  const body = await r.json();
  if (!body?.event_id) throw new Error(`gradio_call_bad_response:${JSON.stringify(body).slice(0, 500)}`);
  return body.event_id;
}

function extractOutputFromSse(text) {
  const lines = text.split(/\r?\n/);
  let last = null;
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      last = parsed;
    } catch {}
  }
  if (!last) throw new Error(`gradio_no_sse_data:${text.slice(-500)}`);
  const first = Array.isArray(last) ? last[0] : last;
  if (typeof first === "string") return first;
  if (first?.url) return first.url;
  if (first?.path) return `${HF_SPACE}/gradio_api/file=${encodeURIComponent(first.path)}`;
  if (first?.data?.url) return first.data.url;
  throw new Error(`gradio_output_unrecognised:${JSON.stringify(last).slice(0, 1000)}`);
}

async function waitGeneration(eventId) {
  const r = await fetch(`${HF_SPACE}/gradio_api/call/generate_audio/${encodeURIComponent(eventId)}`, {
    headers: { accept: "text/event-stream" },
  });
  if (!r.ok) throw new Error(`gradio_result_http_${r.status}:${(await r.text()).slice(0, 500)}`);
  const text = await r.text();
  return extractOutputFromSse(text);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  const key = String(req.query?.sample ?? "love");
  const sample = SAMPLES[key];
  if (!sample) return res.status(400).json({ ok: false, error: "sample must be love, comfort, or joy" });

  const startedAt = Date.now();
  try {
    const reference = await fetchReference();
    const uploadedPath = await gradioUpload(reference);
    const eventId = await startGeneration(uploadedPath, sample);
    const audioUrl = await waitGeneration(eventId);
    return res.status(200).json({
      ok: true,
      model: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
      inferenceMode: "instruct",
      sample: key,
      text: sample.text,
      instruct: sample.instruct,
      audioUrl,
      reference: {
        source: "humyn-labs/korean-voice-emotion-dataset/Young_Female1_Happy.wav",
        licence: "CC BY 4.0",
        maxSecondsUsed: 8,
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      sample: key,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    });
  }
}
