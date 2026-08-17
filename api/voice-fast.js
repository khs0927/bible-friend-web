function tRpcEnvelope(result) {
  return [{ result: { data: { json: result } } }];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const mode = String(req.query?.mode ?? "trpc");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      mode,
      strategy: "instant-device-speech",
      geminiRichVoiceAvailable: Boolean(process.env.GEMINI_API_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // The streaming probe must fail immediately so the browser does not sit in
  // silence waiting for a Gemini audio chunk. AudioPlaybackQueue will then call
  // the normal TTS mutation, which below immediately instructs it to use the
  // already-implemented browser speech fallback.
  if (mode === "stream") {
    return res.status(503).json({
      ok: false,
      code: "instant_device_voice",
      message: "Use device speech immediately",
    });
  }

  const result = {
    success: false,
    provider: "device",
    errorCode: "rate_limit",
    error: "기기 음성으로 바로 재생합니다.",
    fallbackSuggested: true,
    serverResponseAt: Date.now(),
  };

  const isBatch = String(req.query?.batch ?? "") === "1";
  return res.status(200).json(isBatch ? tRpcEnvelope(result) : result);
}
