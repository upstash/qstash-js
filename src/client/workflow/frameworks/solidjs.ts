import type { APIEvent } from "@solidjs/start/server";
import type { WorkflowServeParameters } from "../types";
import { serve as serveBase } from "../serve";

export const serve = <TInitialPayload = unknown>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload>) => {
  // Create a handler which receives an event and calls the
  // serveBase method
  const handler = async (event: APIEvent) => {
    // verify that the request is POST
    const method = event.request.method;
    if (method.toUpperCase() !== "POST") {
      return new Response("Only POST requests are allowed in worklfows", { status: 405 });
    }

    // create serve handler
    const serveHandler = serveBase<TInitialPayload>({
      routeFunction,
      options,
    });

    // invoke serve handler and return result
    return serveHandler(event.request);
  };
  return handler;
};
