import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/trpc";

/**
 * This is the main entrypoint for tRPC requests. It's the function that Next.js
 * will call when it receives a request to the `/api/trpc` endpoint.
 *
 * The `fetchRequestHandler` function from `@trpc/server/adapters/fetch` is
 * used to handle the request. It expects a few options:
 *
 * - `endpoint`: The URL path that the request was made to. This is used to
 *   determine which tRPC procedure was called.
 * - `req`: The Request object that was sent to the server.
 * - `router`: The tRPC router that defines the available procedures.
 * - `createContext`: A function that gets called with the `req` object and
 *   returns an object that will be passed as the `ctx` argument to each
 *   procedure.
 *
 * In this case, the `createContext` function simply returns an empty object.
 */
function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });
}

export { handler as GET, handler as POST };
