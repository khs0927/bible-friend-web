export type Qwen3TTSRequest = {
  text: string;
  instruct?: string;
  language?: string;
  speaker?: string;
};

function timeoutMs() {
  const configured = Number(process.env.QWEN3_TTS_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60_000) : 20_000;
}

export async function synthesizeWithQwen3TTS(req: Qwen3TTSRequest): Promise<Buffer> {
  const baseUrl = process.env.QWEN3_TTS_API_URL?.trim();
  if (!baseUrl) {
    throw new Error("QWEN3_TTS_API_URL is not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const token = process.env.QWEN3_TTS_API_TOKEN?.trim();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "audio/wav",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: req.text,
        language: req.language ?? "Korean",
        speaker: req.speaker ?? process.env.QWEN3_TTS_SPEAKER ?? "Sohee",
        instruct: req.instruct ?? "",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Qwen3-TTS returned HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 44) throw new Error("Qwen3-TTS returned empty audio");
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}
