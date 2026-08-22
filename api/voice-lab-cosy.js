export const config = { api: { bodyParser: false } };
export const maxDuration = 60;

const COSY_SPACE = "https://funaudiollm-fun-cosyvoice3-0-5b.hf.space";
const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;

const SAMPLES = {
  love: {
    text: "하나님은 너를 정말 사랑하신단다. 오늘도 네 마음을 알고 계셔.",
    instruct: "You are a helpful assistant. Speak warmly, gently and sweetly, with sincere affection and a soft smile. Keep the Korean natural and conversational.<|endofprompt|>",
  },
  comfort: {
    text: "괜찮아. 천천히 이야기해 줘. 성경 친구가 함께 들어줄게.",
    instruct: "You are a helpful assistant. Speak softly and calmly as if reassuring a worried child. Use a slightly slower pace, natural empathy and a safe, comforting tone.<|endofprompt|>",
  },
  joy: {
    text: "우와, 정말 잘했어! 오늘도 하나님의 말씀을 함께 알아보자.",
    instruct: "You are a helpful assistant. Speak brightly and happily with genuine delight and an audible smile. Be lively and encouraging without exaggeration.<|endofprompt|>",
  },
};

function authHeaders(extra = {}) {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

function absoluteAudioUrl(space, value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return `${space}${value}`;
    return `${space}/${value}`;
  }
  const candidate = value.url ?? value?.data?.url ?? value.path ?? value?.data?.path ?? null;
  return absoluteAudioUrl(space, candidate);
}

async function gradioCall(space, apiName, data) {
  const start = await fetch(`${space}/gradio_api/call/${apiName}`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ data }),
  });
  if (!start.ok) throw new Error(`${apiName}_start_http_${start.status}:${(await start.text()).slice(0, 500)}`);
  const started = await start.json();
  if (!started?.event_id) throw new Error(`${apiName}_bad_start:${JSON.stringify(started).slice(0, 500)}`);

  const result = await fetch(`${space}/gradio_api/call/${apiName}/${encodeURIComponent(started.event_id)}`, {
    headers: authHeaders({ accept: "text/event-stream" }),
  });
  if (!result.ok) throw new Error(`${apiName}_result_http_${result.status}:${(await result.text()).slice(0, 500)}`);
  const sse = await result.text();
  const parsed = [];
  let currentEvent = "";
  for (const line of sse.split(/\r?\n/)) {
    if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
    if (!line.startsWith("data:")) continue;
    const raw = line.slice(5).trim();
    if (currentEvent === "error") throw new Error(`${apiName}_generation_error:${raw}`);
    if (!raw) continue;
    try { parsed.push(JSON.parse(raw)); } catch {}
  }
  const last = parsed.at(-1);
  if (!last) throw new Error(`${apiName}_empty_result:${sse.slice(-1000)}`);
  return last;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (req.body?.type === "Buffer" && Array.isArray(req.body.data)) return Buffer.from(req.body.data);
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_REFERENCE_BYTES) throw new Error("reference_too_large_max_5mb");
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

function referenceMeta(req) {
  const mime = String(req.headers?.["content-type"] || "audio/wav").split(";")[0].trim().toLowerCase();
  const ext = mime.includes("flac") ? "flac" : mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "wav";
  return { mime: mime.startsWith("audio/") ? mime : "audio/wav", filename: `bible-friend-user-reference.${ext}` };
}

async function cosyUpload(audioBuffer, meta) {
  const form = new FormData();
  form.append("files", new Blob([audioBuffer], { type: meta.mime }), meta.filename);
  const r = await fetch(`${COSY_SPACE}/gradio_api/upload`, { method: "POST", headers: authHeaders(), body: form });
  if (!r.ok) throw new Error(`cosy_upload_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  const body = await r.json();
  const path = Array.isArray(body) ? body[0] : body?.files?.[0] ?? body?.path;
  if (!path) throw new Error(`cosy_upload_bad_response:${JSON.stringify(body).slice(0, 300)}`);
  return path;
}

function cosyFileData(path, meta) {
  return { path, url: `${COSY_SPACE}/gradio_api/file=${encodeURIComponent(path)}`, orig_name: meta.filename, mime_type: meta.mime, meta: { _type: "gradio.FileData" } };
}

async function generateCosy(uploadedPath, meta, sample, seed) {
  const output = await gradioCall(COSY_SPACE, "generate_audio", [
    sample.text, "instruct", "", cosyFileData(uploadedPath, meta), null, sample.instruct, seed, false, "En",
  ]);
  const first = Array.isArray(output) ? output[0] : output;
  const audioUrl = absoluteAudioUrl(COSY_SPACE, first);
  if (!audioUrl) throw new Error(`cosy_output_unrecognised:${JSON.stringify(output).slice(0, 800)}`);
  return audioUrl;
}

async function fetchAudio(url) {
  const r = await fetch(url, { headers: authHeaders(), redirect: "follow" });
  if (!r.ok) throw new Error(`audio_fetch_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET" && String(req.query?.health ?? "") === "1") {
    return res.status(200).json({
      ok: true,
      model: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
      referenceMode: "user-upload-transient",
      persistedInRepo: false,
      maxReferenceBytes: MAX_REFERENCE_BYTES,
      samples: Object.fromEntries(Object.entries(SAMPLES).map(([key, value]) => [key, value.text])),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST audio reference required" });
  const play = String(req.query?.play ?? "");
  if (!SAMPLES[play]) return res.status(400).json({ ok: false, error: "play must be love, comfort, or joy" });

  const startedAt = Date.now();
  try {
    const reference = await readRawBody(req);
    if (!reference.length) return res.status(400).json({ ok: false, error: "empty reference audio" });
    if (reference.length > MAX_REFERENCE_BYTES) return res.status(413).json({ ok: false, error: "reference audio exceeds 5 MB" });
    const meta = referenceMeta(req);
    const uploadedPath = await cosyUpload(reference, meta);
    const audioUrl = await generateCosy(uploadedPath, meta, SAMPLES[play], 20260823 + ["love", "comfort", "joy"].indexOf(play));
    const wav = await fetchAudio(audioUrl);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `inline; filename=bible-friend-cosy-${play}.wav`);
    res.setHeader("X-Bible-Friend-Model", "Fun-CosyVoice3-0.5B-2512");
    res.setHeader("X-Bible-Friend-Reference", "user-upload-transient");
    res.setHeader("X-Bible-Friend-Elapsed-Ms", String(Date.now() - startedAt));
    return res.status(200).send(wav);
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt });
  }
}
