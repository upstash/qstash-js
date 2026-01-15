import type { RequestHandler } from "@sveltejs/kit";
import { Receiver } from "../src";

import type { RouteFunction, WorkflowServeOptions } from "../src/client/workflow";
import { serve as serveBase } from "../src/client/workflow";

type VerifySignatureConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
};

export const verifySignatureSvelte = <
  Parameters extends Partial<Record<string, string>> = Partial<Record<string, string>>,
  RouteId extends string | null = string | null,
>(
  handler: RequestHandler<Parameters, RouteId>,
  config?: VerifySignatureConfig
) => {
  const currentSigningKey = config?.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = config?.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;

  // Only throw if both keys are missing and not in multi-region mode
  if (!currentSigningKey && !nextSigningKey && !process.env.QSTASH_REGION) {
    throw new Error(
      "currentSigningKey and nextSigningKey are required, either in the config or as env variables (QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY)"
    );
  }

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
  const wrappedHandler: RequestHandler<Parameters, RouteId> = async (event) => {
    const signature = event.request.headers.get("upstash-signature");
    if (!signature) {
      return new Response("`Upstash-Signature` header is missing", { status: 403 });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }
    const upstashRegion = event.request.headers.get("upstash-region");
    const cloneRequest = event.request.clone();
    const body = await cloneRequest.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
      upstashRegion: upstashRegion ?? undefined,
    });
    if (!isValid) {
      return new Response("invalid signature", { status: 403 });
    }
    return handler(event);
  };
  return wrappedHandler;
};

/**
 * Serve method to serve a Upstash Workflow in a Nextjs project
 *
 * See for options https://upstash.com/docs/qstash/workflows/basics/serve
 *
 * @param routeFunction workflow function
 * @param options workflow options
 * @returns
 *
 * @deprecated as of version 2.7.17. Will be removed in qstash-js 3.0.0.
 * Please use https://github.com/upstash/workflow-js
 * Migration Guide: https://upstash.com/docs/workflow/migration
 */
export const serve = <TInitialPayload = unknown>(
  routeFunction: RouteFunction<TInitialPayload>,
  options: Omit<WorkflowServeOptions<Response, TInitialPayload>, "onStepFinish"> & {
    env: WorkflowServeOptions["env"];
  }
): RequestHandler => {
  const handler: RequestHandler = async ({ request }) => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const serveMethod = serveBase<TInitialPayload>(routeFunction, options);
    return await serveMethod(request);
  };

  return handler;
};
