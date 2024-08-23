import type { Context } from "hono";
import type { RouteFunction, WorkflowServeOptions } from "../src/client/workflow";
import { serve as serveBase } from "../src/client/workflow";
import { Client, Receiver } from "../src";

export type WorkflowBindings = {
  QSTASH_TOKEN: string;
  QSTASH_URL?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  UPSTASH_WORKFLOW_URL?: string;
};

/**
 * Serve method to serve a QStash workflow in a Nextjs project
 *
 * See for options https://upstash.com/docs/qstash/workflows/basics/serve
 *
 * @param routeFunction workflow function
 * @param options workflow options
 * @returns
 */
export const serve = <
  TInitialPayload = unknown,
  TBindings extends WorkflowBindings = WorkflowBindings,
>(
  routeFunction: RouteFunction<TInitialPayload>,
  options?: Omit<WorkflowServeOptions<Response, TInitialPayload>, "onStepFinish">
): ((context: Context<{ Bindings: TBindings }>) => Promise<Response>) => {
  const handler = async (context: Context<{ Bindings: TBindings }>) => {
    const environment = context.env;
    const request = context.req.raw;

    const serveHandler = serveBase(routeFunction, {
      qstashClient: new Client({
        baseUrl: environment.QSTASH_URL,
        token: environment.QSTASH_TOKEN,
      }),
      receiver:
        environment.QSTASH_CURRENT_SIGNING_KEY && environment.QSTASH_NEXT_SIGNING_KEY
          ? new Receiver({
              currentSigningKey: environment.QSTASH_CURRENT_SIGNING_KEY,
              nextSigningKey: environment.QSTASH_NEXT_SIGNING_KEY,
            })
          : undefined,
      baseUrl: environment.UPSTASH_WORKFLOW_URL,
      env: environment,
      ...options,
    });
    return await serveHandler(request);
  };
  return handler;
};
