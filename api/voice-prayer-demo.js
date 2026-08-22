const MODEL = "gemini-3.1-flash-tts-preview";
const VOICE = "Leda";
const GEMINI_HOST = "https://generativelanguage.googleapis.com";

const TEXT = `안녕! 기도가 무엇인지 궁금했구나? 기도는 전혀 어렵지 않아요. 사랑하는 가장 친한 친구에게 마음을 털어놓듯 하나님께 편하게 이야기하는 거랍니다.

성경에는 하나님께서 우리의 작은 목소리에도 항상 귀를 기울이신다고 기록되어 있어요. "하나님, 오늘 너무 기뻤어요"라고 감사하거나, 힘들 때 "저 좀 도와주세요" 하고 마음을 말하면 돼요.

마지막에는 "예수님의 이름으로 기도합니다, 아멘" 하고 마치면 된단다. 오늘 하나님께 제일 먼저 하고 싶은 말은 무엇인가요?`;

function makeWavFromPcm(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  if (pcm.subarray(0, 4).toString("ascii") === "RIFF") return pcm;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function extractAudio(body) {
  if (typeof body?.output_audio?.data === "string") return body.output_audio.data;
  for (const step of Array.isArray(body?.steps) ? body.steps : []) {
    for (const block of Array.isArray(step?.content) ? step.content : []) {
      if (typeof block?.data === "string" && (block?.type === "audio" || !block?.type)) return block.data;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return res.status(503).json({ ok: false, error: "gemini_not_configured" });

  const prompt = [
    "음성 합성 요청입니다. 아래 '낭독할 본문'만 실제 음성으로 합성하고, 지시문 자체는 읽지 마세요.",
    "밝고 친근하며 따뜻한 성경 친구처럼 말해 주세요.",
    "6~12세 어린이가 이해하기 쉬운 자연스러운 한국어 발음으로 말해 주세요.",
    "너무 느리거나 과장된 유아 말투는 피하고, 또렷하고 편안하게 말해 주세요.",
    "자연스러운 속도로 말해 주세요.",
    "감정은 따뜻하고 친근한 격려로 표현해 주세요.",
    "자연스럽고 또렷하게, 문장 사이에 짧게 호흡하며 읽어 줘.",
    "낭독할 본문:",
    TEXT,
  ].join("\n");

  try {
    const response = await fetch(`${GEMINI_HOST}/v1beta/interactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: VOICE }] },
      }),
    });

    const raw = await response.text();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: `gemini_http_${response.status}` });
    const body = JSON.parse(raw);
    const encoded = extractAudio(body);
    if (!encoded) return res.status(502).json({ ok: false, error: "gemini_no_audio" });
    const wav = makeWavFromPcm(Buffer.from(encoded, "base64"));

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", 'attachment; filename="bible-friend-prayer-leda.wav"');
    res.setHeader("Content-Length", String(wav.length));
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("X-Bible-Friend-TTS-Model", MODEL);
    res.setHeader("X-Bible-Friend-TTS-Voice", VOICE);
    return res.status(200).send(wav);
  } catch (error) {
    console.error("[VOICE_PRAYER_DEMO] failed", { message: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ ok: false, error: "voice_demo_failed" });
  }
}
