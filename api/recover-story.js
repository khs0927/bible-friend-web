const SOURCE_BASE = "https://3000-i47mrn7noomyhycbk0nld-b641ebb5.sg1.manus.computer/manus-storage/";

const ALLOWED = new Set([
  "story_noah_a1e0e2bf.png",
  "story_david_0b7c9097.png",
  "story_jesus_9ab7568d.png",
  "story_creation_4ad3b88a.png",
  "story_creation_3e9569ce.png",
  "story_joseph_aa32c037.png",
]);

export default async function handler(req, res) {
  const key = String(req.query?.key ?? "");
  if (!ALLOWED.has(key)) {
    res.statusCode = 404;
    res.end("not_found");
    return;
  }

  try {
    const upstream = await fetch(`${SOURCE_BASE}${encodeURIComponent(key)}`, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 BibleFriendAssetRecovery/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, key, upstreamStatus: upstream.status, finalUrl: upstream.url }));
      return;
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("content-type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-recovered-story-key", key);
    res.end(bytes);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, key, error: error instanceof Error ? error.message : String(error) }));
  }
}
