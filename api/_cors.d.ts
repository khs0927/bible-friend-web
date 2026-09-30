export function allowedOrigins(extra?: string): Set<string>;
export function applyCors(
  req: { method?: string; headers: Record<string, string | string[] | undefined> },
  res: { setHeader(name: string, value: string): unknown; statusCode: number; end(): unknown },
  origins?: Set<string>,
): boolean;
