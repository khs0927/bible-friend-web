const COSY_SPACE = "https://funaudiollm-fun-cosyvoice3-0-5b.hf.space";
const QWEN_SPACE = "https://qwen-qwen3-tts.hf.space";
const REFERENCE_TEXT = "안녕, 성경 친구야. 오늘도 네 이야기를 따뜻하게 들어줄게.";
const REFERENCE_DESCRIPTION = [
  "Create an original native Korean female voice in her early twenties.",
  "The voice should be naturally bright, warm, sweet and reassuring, suitable for children aged six to twelve.",
  "Use clear Korean diction, a gentle smiling resonance, soft natural breath and subtle emotional expressiveness.",
  "The baseline feeling is calm affection and trust, with enough energy to become genuinely joyful when needed.",
  "Do not imitate or reference any existing named voice or real person.",
  "Avoid cartoonish acting, baby talk, excessive pitch, seductiveness, breathiness, announcer style, or robotic cadence.",
  "Studio-clean close-microphone sound, conversational and emotionally believable.",
].join(" ");

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

async function designReference() {
  const output = await gradioCall(QWEN_SPACE, "generate_voice_design", [
    REFERENCE_TEXT,
    "Korean",
    REFERENCE_DESCRIPTION,
  ]);
  const first = Array.isArray(output) ? output[0] : output;
  const audioUrl = absoluteAudioUrl(QWEN_SPACE, first);
  if (!audioUrl) throw new Error(`qwen_reference_unrecognised:${JSON.stringify(output).slice(0, 800)}`);
  const r = await fetch(audioUrl, { headers: authHeaders(), redirect: "follow" });
  if (!r.ok) throw new Error(`qwen_reference_audio_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  return { wav: Buffer.from(await r.arrayBuffer()), audioUrl };
}

async function cosyUpload(wav) {
  const form = new FormData();
  form.append("files", new Blob([wav], { type: "audio/wav" }), "bible-friend-sweet-reference.wav");
  const r = await fetch(`${COSY_SPACE}/gradio_api/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!r.ok) throw new Error(`cosy_upload_http_${r.status}:${(await r.text()).slice(0, 300)}`);
  const body = await r.json();
  const path = Array.isArray(body) ? body[0] : body?.files?.[0] ?? body?.path;
  if (!path) throw new Error(`cosy_upload_bad_response:${JSON.stringify(body).slice(0, 300)}`);
  return path;
}

function cosyFileData(path) {
  return {
    path,
    url: `${COSY_SPACE}/gradio_api/file=${encodeURIComponent(path)}`,
    orig_name: "bible-friend-sweet-reference.wav",
    mime_type: "audio/wav",
    meta: { _type: "gradio.FileData" },
  };
}

async function generateCosy(uploadedPath, sample, seed) {
  const output = await gradioCall(COSY_SPACE, "generate_audio", [
    sample.text,
    "instruct",
    "",
    cosyFileData(uploadedPath),
    null,
    sample.instruct,
    seed,
    false,
    "En",
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

async function makeOne(key, uploadedPath, index) {
  const sample = SAMPLES[key];
  const startedAt = Date.now();
  try {
    const audioUrl = await generateCosy(uploadedPath, sample, 20260823 + index);
    return { ok: true, sample: key, text: sample.text, audioUrl, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, sample: key, text: sample.text, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  const startedAt = Date.now();
  try {
    const reference = await designReference();

    if (String(req.query?.reference ?? "") === "1") {
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Disposition", "inline; filename=bible-friend-sweet-reference.wav");
      return res.status(200).send(reference.wav);
    }

    const play = String(req.query?.play ?? "");
    if (play) {
      if (!SAMPLES[play]) return res.status(400).json({ ok: false, error: "play must be love, comfort, or joy" });
      const uploadedPath = await cosyUpload(reference.wav);
      const audioUrl = await generateCosy(uploadedPath, SAMPLES[play], 20260823);
      const wav = await fetchAudio(audioUrl);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Disposition", `inline; filename=bible-friend-cosy-${play}.wav`);
      res.setHeader("X-Bible-Friend-Model", "Fun-CosyVoice3-0.5B-2512");
      res.setHeader("X-Bible-Friend-Elapsed-Ms", String(Date.now() - startedAt));
      return res.status(200).send(wav);
    }

    const requested = String(req.query?.sample ?? "all");
    const keys = requested === "all" ? ["love", "comfort", "joy"] : [requested];
    if (keys.some((key) => !SAMPLES[key])) {
      return res.status(400).json({ ok: false, error: "sample must be all, love, comfort, or joy" });
    }

    const uploadedPath = await cosyUpload(reference.wav);
    const outputs = await Promise.all(keys.map((key, index) => makeOne(key, uploadedPath, index)));
    return res.status(outputs.every((item) => item.ok) ? 200 : 207).json({
      ok: outputs.every((item) => item.ok),
      model: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
      inferenceMode: "instruct2-with-original-reference",
      outputs,
      reference: {
        sourceModel: "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        text: REFERENCE_TEXT,
        description: REFERENCE_DESCRIPTION,
        bytes: reference.wav.length,
        persisted: false,
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt });
  }
}
