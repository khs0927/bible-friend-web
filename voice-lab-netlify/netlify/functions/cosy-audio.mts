import { getStore } from "@netlify/blobs";

const valid = (value: string) => /^[0-9a-f-]{30,50}$/i.test(value);

export default async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!valid(id)) return new Response("invalid id", { status: 400 });

  const db = getStore("bible-friend-voice-lab", { consistency: "strong" });
  const data = await db.get(`audio/${id}.wav`, { type: "arrayBuffer" });
  if (!data) return new Response("audio not ready", { status: 404 });

  return new Response(data, {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "private, max-age=3600",
      "content-disposition": `inline; filename="bible-friend-cosy-${id}.wav"`,
    },
  });
};

export const config = { path: "/api/cosy-audio" };
