const TRIPO_BASE_URL = "https://openapi.tripo3d.ai/v3";

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
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Tripo API ${response.status}: ${await response.text()}`);
  const payload = await response.json() as { code?: number; data?: any; message?: string };
  if (payload.code !== undefined && payload.code !== 0) throw new Error(payload.message || `Tripo API error code ${payload.code}`);
  return payload.data;
}

export async function createTripoImageModel(input: string, options?: {
  model?: "tripo-p1" | "tripo-turbo" | "tripo-v3.1" | "tripo-v3.0";
  faceLimit?: number;
}) {
  const model = options?.model ?? "tripo-p1";
  const body: Record<string, unknown> = {
    input,
    model,
    texture: true,
    pbr: true,
    enable_image_autofix: true,
    orientation: "align_image",
  };
  if (model === "tripo-p1" && options?.faceLimit) body.face_limit = options.faceLimit;
  const data = await tripoFetch("/generation/image-to-model", { method: "POST", body: JSON.stringify(body) });
  if (!data?.task_id) throw new Error("Tripo did not return a task_id");
  return String(data.task_id);
}

export async function getTripoTask(taskId: string): Promise<TripoModelOutput> {
  const data = await tripoFetch(`/tasks/${encodeURIComponent(taskId)}`, { method: "GET" });
  return {
    taskId,
    status: String(data?.status ?? "unknown"),
    progress: Number(data?.progress ?? 0),
    modelUrl: data?.output?.model_url ? String(data.output.model_url) : undefined,
    previewUrl: data?.output?.rendered_image_url ? String(data.output.rendered_image_url) : undefined,
  };
}

export async function waitForTripoModel(taskId: string, options?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 2_500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await getTripoTask(taskId);
    if (result.status === "success") return result;
    if (["failed", "cancelled", "banned"].includes(result.status)) throw new Error(`Tripo task ${taskId} ended with ${result.status}`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Tripo task ${taskId} timed out`);
}
