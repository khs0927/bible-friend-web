// Stable Vercel serverless entrypoint used by vercel.json rewrites.
// Keep the application implementation in the catch-all handler so direct
// /api routes and rewritten routes share the exact same Express/tRPC stack.
export { default } from "./[...path]";
