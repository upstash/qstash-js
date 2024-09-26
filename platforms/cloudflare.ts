import type { RouteFunction, WorkflowServeOptions } from "../src/client/workflow";
import { serve as serveBase } from "../src/client/workflow";

export type WorkflowBindings = {
  QSTASH_TOKEN: string;
  QSTASH_URL?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  UPSTASH_WORKFLOW_URL?: string;
};

/**
 * Cloudflare Pages Function arguments
 */
export type PagesHandlerArgs = [{ request: Request; env: Record<string, string | undefined> }];

/**
 * Cloudflare Worker arguments
 */
export type WorkersHandlerArgs = [Request, Record<string, string | undefined>];

/**
 * Support both Cloudflare Pages Functions and Cloudflare Workers
 */
const getArgs = (
  args: PagesHandlerArgs | WorkersHandlerArgs
): { request: Request; env: Record<string, string | undefined> } => {
  // @ts-expect-error types of args don't allow length 0, but want to sanity check
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error("No arguments passed to serve handler");
  }

  if (typeof args[0] === "object" && "request" in args[0] && "env" in args[0]) {
    return {
      request: args[0].request,
      env: args[0].env,
    };
  }

  if (args.length > 1 && typeof args[1] === "object") {
    return {
      request: args[0],
      env: args[1],
    };
  }

  throw new Error("Could not derive handler arguments from input. Please check how serve is used.");
};

/**
 * Serve method to serve a Upstash Workflow in a Nextjs project
 *
 * See for options https://upstash.com/docs/qstash/workflows/basics/serve
 *
 * @param routeFunction workflow function
 * @param options workflow options
 * @returns
 */
export const serve = <TInitialPayload = unknown>(
  routeFunction: RouteFunction<TInitialPayload>,
  options?: Omit<WorkflowServeOptions<Response, TInitialPayload>, "onStepFinish">
): ((...args: PagesHandlerArgs | WorkersHandlerArgs) => Promise<Response>) => {
  const handler = async (...args: PagesHandlerArgs | WorkersHandlerArgs) => {
    const { request, env } = getArgs(args);
    const serveHandler = serveBase(routeFunction, {
      env,
      ...options,
    });
    return await serveHandler(request);
  };
  return handler;
};
