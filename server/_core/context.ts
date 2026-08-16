import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

type ExpressContextResponse = CreateExpressContextOptions["res"] & {
  clearCookie: (name: string, options?: Record<string, unknown>) => unknown;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: ExpressContextResponse;
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res as ExpressContextResponse,
    user,
  };
}
