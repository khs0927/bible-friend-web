import { getStore } from "@netlify/blobs";

const valid = (value: string) => /^[0-9a-f-]{30,50}$/i.test(value);

export default async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!valid(id)) return Response.json({ error: "invalid id" }, { status: 400 });

  const db = getStore("bible-friend-voice-lab", { consistency: "strong" });
  const data = await db.get(`jobs/${id}.json`, { type: "json" });
  if (!data) {
    return Response.json({ status: "queued" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  return Response.json(data, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/cosy-status" };
