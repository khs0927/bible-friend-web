const TRIPO_BASE_URL = "https://api.tripo3d.ai/v2/openapi";

export type TripoModelVersion = "P1-20260311" | "Turbo-v1.0-20250506" | "v3.1-20260211" | "v3.0-20250812";

export type TripoModelOutput = {
  taskId: string;
  modelUrl?: string;
  previewUrl?: string;
  status: string;
  progress: number;
};

function getApiKey() {
  const key = process.env.TRIPO_API_KEY?.trim();
  if (!key) throw new Error("TRIPO_API_KEY is not configured");
  return key;
}

async function tripoFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${TRIPO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Tripo API ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { code?: number; data?: any; message?: string };
  if (payload.code !== undefined && payload.code !== 0) throw new Error(payload.message || `Tripo API error code ${payload.code}`);
  return payload.data;
}

function imageType(url: string): "png" | "jpeg" | "webp" {
  const clean = url.split("?")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  return "jpeg";
}

export async function createTripoImageModel(imageUrl: string, options?: {
  modelVersion?: TripoModelVersion;
  faceLimit?: number;
  texture?: boolean;
  pbr?: boolean;
}) {
  const body: Record<string, unknown> = {
    type: "image_to_model",
    model_version: options?.modelVersion ?? "P1-20260311",
    file: { type: imageType(imageUrl), url: imageUrl },
    texture: options?.texture ?? true,
    pbr: options?.pbr ?? true,
  };
  if (options?.faceLimit) body.face_limit = Math.max(48, Math.min(20_000, Math.round(options.faceLimit)));
  const data = await tripoFetch("/task", { method: "POST", body: JSON.stringify(body) });
  if (!data?.task_id) throw new Error("Tripo did not return a task_id");
  return String(data.task_id);
}

export async function createTripoMultiviewModel(input: {
  front: string;
  left?: string;
  back?: string;
  right?: string;
  modelVersion?: Exclude<TripoModelVersion, "Turbo-v1.0-20250506">;
  faceLimit?: number;
}) {
  const file = (url?: string) => url ? { type: imageType(url), url } : {};
  const body: Record<string, unknown> = {
    type: "multiview_to_model",
    model_version: input.modelVersion ?? "P1-20260311",
    files: [file(input.front), file(input.left), file(input.back), file(input.right)],
    texture: true,
    pbr: true,
  };
  if (input.faceLimit) body.face_limit = Math.max(48, Math.min(20_000, Math.round(input.faceLimit)));
  const data = await tripoFetch("/task", { method: "POST", body: JSON.stringify(body) });
  if (!data?.task_id) throw new Error("Tripo did not return a task_id");
  return String(data.task_id);
}

export async function getTripoTask(taskId: string): Promise<TripoModelOutput> {
  const data = await tripoFetch(`/task/${encodeURIComponent(taskId)}`, { method: "GET" });
  const output = data?.output ?? {};
  return {
    taskId,
    status: String(data?.status ?? "unknown"),
    progress: Number(data?.progress ?? 0),
    modelUrl: output.pbr_model ? String(output.pbr_model) : output.model ? String(output.model) : output.base_model ? String(output.base_model) : undefined,
    previewUrl: output.rendered_image ? String(output.rendered_image) : undefined,
  };
}

export async function waitForTripoModel(taskId: string, options?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 2_500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await getTripoTask(taskId);
    if (result.status === "success") return result;
    if (["failed", "cancelled", "banned", "expired", "unknown"].includes(result.status)) throw new Error(`Tripo task ${taskId} ended with ${result.status}`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Tripo task ${taskId} timed out`);
}
