import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};
export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = { type: "function"; function: { name: string } };
export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export type ModelInfo = { id: string; object: string; created: number; owned_by: string };
export type ModelsResponse = { object: string; data: ModelInfo[] };

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const RETRY_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 350;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] => Array.isArray(value) ? value : [value];

function normalizeContentPart(part: MessageContent): TextContent | ImageContent | FileContent {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
}

function normalizeMessage(message: Message) {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    return {
      role,
      name,
      tool_call_id,
      content: ensureArray(message.content).map(part => typeof part === "string" ? part : JSON.stringify(part)).join("\n"),
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }
  return { role, name, content: contentParts };
}

function normalizeToolChoice(toolChoice: ToolChoice | undefined, tools: Tool[] | undefined): "none" | "auto" | ToolChoiceExplicit | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools?.length) throw new Error("tool_choice 'required' was provided but no tools were configured");
    if (tools.length > 1) throw new Error("tool_choice 'required' needs a single tool or explicit tool name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) return { type: "function", function: { name: toolChoice.name } };
  return toolChoice;
}

function normalizeResponseFormat(params: InvokeParams): ResponseFormat | undefined {
  const explicit = params.responseFormat ?? params.response_format;
  if (explicit) return explicit;
  const schema = params.outputSchema ?? params.output_schema;
  if (!schema) return undefined;
  return { type: "json_schema", json_schema: schema };
}

function usingForge() {
  return Boolean(ENV.forgeApiKey?.trim());
}

function apiKey() {
  const key = usingForge() ? ENV.forgeApiKey : ENV.geminiApiKey;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

function chatUrl() {
  if (usingForge()) {
    const base = ENV.forgeApiUrl?.trim() || "https://forge.manus.im";
    return `${base.replace(/\/$/, "")}/v1/chat/completions`;
  }
  return `${GOOGLE_OPENAI_BASE}/chat/completions`;
}

function modelsUrl() {
  if (usingForge()) {
    const base = ENV.forgeApiUrl?.trim() || "https://forge.manus.im";
    return `${base.replace(/\/$/, "")}/v1/models`;
  }
  return `${GOOGLE_OPENAI_BASE}/models`;
}

async function fetchWithBackoff(url: string, init: FetchInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES || (response.status < 429 && response.status !== 408)) return response;
      try { await response.body?.cancel(); } catch {}
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed");
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const payload: Record<string, unknown> = {
    messages: params.messages.map(normalizeMessage),
    model: params.model ?? "gemini-2.5-flash",
  };

  if (params.tools?.length) payload.tools = params.tools;
  const toolChoice = normalizeToolChoice(params.toolChoice ?? params.tool_choice, params.tools);
  if (toolChoice) payload.tool_choice = toolChoice;

  const maxTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;

  const responseFormat = normalizeResponseFormat(params);
  if (responseFormat) payload.response_format = responseFormat;

  // Manus Forge supports these extension fields; Google's OpenAI compatibility
  // endpoint does not require them for Bible Friend chat, so omit them there.
  if (usingForge()) {
    if (params.thinking) payload.thinking = params.thinking;
    if (params.reasoning) payload.reasoning = params.reasoning;
  }

  const provider = usingForge() ? "forge" : "gemini-direct";
  const startedAt = Date.now();
  const response = await fetchWithBackoff(chatUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn("[LLM] request failed", { provider, status: response.status, ms: Date.now() - startedAt });
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 500)}`);
  }

  const result = (await response.json()) as InvokeResult;
  console.info("[LLM] request success", { provider, model: result.model ?? payload.model, ms: Date.now() - startedAt });
  return result;
}

export async function listLLMModels(): Promise<ModelsResponse> {
  const response = await fetchWithBackoff(modelsUrl(), {
    headers: { authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List LLM models failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 500)}`);
  }
  return (await response.json()) as ModelsResponse;
}
