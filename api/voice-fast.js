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

  // This legacy fast-fallback endpoint is intentionally not treated as a
  // Gemini quota/rate-limit condition. It only asks the client to continue
  // with the device voice immediately.
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
    errorCode: "device_fallback",
    error: "기기 음성으로 바로 이어서 들려줘요.",
    fallbackSuggested: true,
    serverResponseAt: Date.now(),
  };

  const isBatch = String(req.query?.batch ?? "") === "1";
  return res.status(200).json(isBatch ? tRpcEnvelope(result) : result);
}
