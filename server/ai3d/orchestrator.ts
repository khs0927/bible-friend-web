import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createTripoImageModel, getTripoTask } from "./tripo";

export type Ai3dProvider = "remote-worker" | "tripo";
export type Ai3dJobStatus = "queued" | "running" | "success" | "failed";

export interface Ai3dJob {
  provider: Ai3dProvider;
  jobId: string;
  status: Ai3dJobStatus;
  progress: number;
  modelUrl?: string;
  previewUrl?: string;
}

export interface Ai3dImageInput {
  assetId: string;
  imageUrl: string;
  faceLimit?: number;
}

type Env = Record<string, string | undefined>;

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function resolveAi3dProvider(env: Env = process.env): Ai3dProvider {
  if (env.AI3D_WORKER_URL?.trim()) return "remote-worker";
  if (env.TRIPO_API_KEY?.trim()) return "tripo";
  throw new Error("No AI-3D provider configured. Set AI3D_WORKER_URL for an open-source worker or TRIPO_API_KEY for Tripo.");
}

async function workerFetch(path: string, init: RequestInit, env: Env) {
  const base = env.AI3D_WORKER_URL?.trim();
  if (!base) throw new Error("AI3D_WORKER_URL is not configured");
  const token = env.AI3D_WORKER_TOKEN?.trim();
  const response = await fetch(`${cleanBaseUrl(base)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`AI-3D worker ${response.status}: ${await response.text()}`);
  return response.json() as Promise<Record<string, any>>;
}

export async function startAi3dJob(input: Ai3dImageInput, env: Env = process.env): Promise<Ai3dJob> {
  const provider = resolveAi3dProvider(env);
  if (provider === "tripo") {
    const jobId = await createTripoImageModel(input.imageUrl, { faceLimit: input.faceLimit ?? 20_000 });
    return { provider, jobId, status: "queued", progress: 0 };
  }

  const data = await workerFetch("/v1/image-to-3d", {
    method: "POST",
    body: JSON.stringify({
      assetId: input.assetId,
      imageUrl: input.imageUrl,
      outputFormat: "glb",
      faceLimit: input.faceLimit ?? 30_000,
    }),
  }, env);
  const jobId = String(data.jobId ?? data.job_id ?? "");
  if (!jobId) throw new Error("AI-3D worker did not return a job id");
  return { provider, jobId, status: "queued", progress: Number(data.progress ?? 0) };
}

function normalizeStatus(value: unknown): Ai3dJobStatus {
  const status = String(value ?? "").toLowerCase();
  if (["success", "succeeded", "completed", "complete", "done"].includes(status)) return "success";
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(status)) return "failed";
  if (["running", "processing", "generating"].includes(status)) return "running";
  return "queued";
}

export async function getAi3dJob(job: Pick<Ai3dJob, "provider" | "jobId">, env: Env = process.env): Promise<Ai3dJob> {
  if (job.provider === "tripo") {
    const result = await getTripoTask(job.jobId);
    return {
      provider: "tripo",
      jobId: job.jobId,
      status: normalizeStatus(result.status),
      progress: result.progress,
      modelUrl: result.modelUrl,
      previewUrl: result.previewUrl,
    };
  }

  const data = await workerFetch(`/v1/jobs/${encodeURIComponent(job.jobId)}`, { method: "GET" }, env);
  return {
    provider: "remote-worker",
    jobId: job.jobId,
    status: normalizeStatus(data.status),
    progress: Number(data.progress ?? 0),
    modelUrl: data.modelUrl ? String(data.modelUrl) : data.model_url ? String(data.model_url) : undefined,
    previewUrl: data.previewUrl ? String(data.previewUrl) : data.preview_url ? String(data.preview_url) : undefined,
  };
}

export function validateGlb(bytes: Uint8Array) {
  if (bytes.byteLength < 12) throw new Error("Generated GLB is too small");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Generated asset is not a GLB file");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > bytes.byteLength || declaredLength < 12) throw new Error("Generated GLB has an invalid declared length");
  return { version, declaredLength };
}

function safeAssetId(assetId: string) {
  const value = assetId.toLowerCase().trim().replace(/[^a-z0-9/_-]+/g, "-").replace(/\.{2,}/g, "-").replace(/^\/+|\/+$/g, "");
  if (!value) throw new Error("assetId is empty after sanitization");
  return value;
}

export function ai3dObjectKey(assetId: string) {
  return `growth/3d/${safeAssetId(assetId)}.glb`;
}

function storageConfig(env: Env) {
  const bucket = env.AI3D_ASSET_BUCKET?.trim();
  const accessKeyId = env.AI3D_ASSET_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AI3D_ASSET_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = env.AI3D_ASSET_PUBLIC_BASE_URL?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error("AI-3D persistent storage is not configured. Set AI3D_ASSET_BUCKET, AI3D_ASSET_ACCESS_KEY_ID, AI3D_ASSET_SECRET_ACCESS_KEY and AI3D_ASSET_PUBLIC_BASE_URL.");
  }
  return {
    bucket,
    publicBaseUrl: cleanBaseUrl(publicBaseUrl),
    endpoint: env.AI3D_ASSET_ENDPOINT?.trim(),
    region: env.AI3D_ASSET_REGION?.trim() || "auto",
    forcePathStyle: env.AI3D_ASSET_FORCE_PATH_STYLE === "true",
    accessKeyId,
    secretAccessKey,
  };
}

export async function persistRemoteGlb(input: { assetId: string; sourceUrl: string }, env: Env = process.env) {
  const source = new URL(input.sourceUrl);
  if (source.protocol !== "https:") throw new Error("AI-3D model downloads must use HTTPS");
  const response = await fetch(source, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not download generated GLB: ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  const maxBytes = 25 * 1024 * 1024;
  if (declaredSize > maxBytes) throw new Error("Generated GLB exceeds the 25 MB mobile asset limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Generated GLB exceeds the 25 MB mobile asset limit");
  validateGlb(bytes);

  const config = storageConfig(env);
  const key = ai3dObjectKey(input.assetId);
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: bytes,
    ContentType: "model/gltf-binary",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, url: `${config.publicBaseUrl}/${key}` };
}
