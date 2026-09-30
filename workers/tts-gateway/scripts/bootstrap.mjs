#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(process.cwd());
const baseConfig = resolve(cwd, "wrangler.base.toml");
const exampleConfig = resolve(cwd, "wrangler.example.toml");
const outputConfig = resolve(cwd, "wrangler.toml");

function run(args, options = {}) {
  return execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["wrangler", ...args], {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

function listNamespaces() {
  const raw = run(["kv", "namespace", "list", "--config", baseConfig], { capture: true });
  const start = raw.indexOf("[");
  const jsonText = start >= 0 ? raw.slice(start) : raw;
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Unexpected KV namespace list response");
  return parsed;
}

function ensureNamespace(title) {
  let list = listNamespaces();
  let found = list.find(item => item?.title === title);
  if (!found) {
    console.log(`Creating KV namespace: ${title}`);
    run(["kv", "namespace", "create", title, "--config", baseConfig]);
    list = listNamespaces();
    found = list.find(item => item?.title === title);
  }
  if (!found?.id) throw new Error(`Unable to resolve KV namespace ID for ${title}`);
  return found.id;
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_API_TOKEN is required");
}
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
}

const audioId = ensureNamespace("bible-friend-tts-audio");
const circuitId = ensureNamespace("bible-friend-tts-circuit");

let config = readFileSync(exampleConfig, "utf8");
config = config
  .replace("REPLACE_AUDIO_CACHE_NAMESPACE_ID", audioId)
  .replace("REPLACE_CIRCUIT_STATE_NAMESPACE_ID", circuitId);

writeFileSync(outputConfig, config);
console.log("Generated wrangler.toml with KV bindings.");
console.log(JSON.stringify({ audioNamespaceId: audioId, circuitNamespaceId: circuitId }, null, 2));
