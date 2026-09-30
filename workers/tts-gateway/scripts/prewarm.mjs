#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const gateway = (process.env.TTS_GATEWAY_URL || "").replace(/\/$/, "");
const token = process.env.TTS_GATEWAY_TOKEN || "";
const source = process.argv[2] || new URL("./prewarm.example.json", import.meta.url);

if (!gateway) {
  console.error("Set TTS_GATEWAY_URL before running prewarm.");
  process.exit(1);
}

const raw = await readFile(source, "utf8");
const entries = JSON.parse(raw);
if (!Array.isArray(entries)) {
  throw new Error("Prewarm file must contain a JSON array.");
}

let ok = 0;
let failed = 0;

for (const [index, entry] of entries.entries()) {
  const payload = {
    text: entry.text,
    speaker: entry.speaker || "Sohee",
    language: entry.language || "Korean",
    emotion: entry.emotion || "따뜻하고 자연스럽게",
    style: entry.style || "아이에게 성경 말씀을 다정하고 또렷하게 읽어 주세요.",
    speed: entry.speed ?? 0.96,
  };

  try {
    const response = await fetch(`${gateway}/api/voice/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${detail.slice(0, 120)}`);
    }

    const bytes = (await response.arrayBuffer()).byteLength;
    ok += 1;
    console.log(`[${index + 1}/${entries.length}] cached: ${entry.ref || entry.text.slice(0, 24)} (${bytes} bytes)`);
  } catch (error) {
    failed += 1;
    console.error(`[${index + 1}/${entries.length}] failed: ${entry.ref || "entry"} - ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(JSON.stringify({ total: entries.length, ok, failed }, null, 2));
if (failed > 0) process.exitCode = 2;
