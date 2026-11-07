// Stand-in for Deno's std `serve`: remembers the handler so tests can call it directly.
// deno-lint-ignore no-explicit-any
export function serve(handler: (req: Request) => Response | Promise<Response>): void {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).__handler = handler
}
