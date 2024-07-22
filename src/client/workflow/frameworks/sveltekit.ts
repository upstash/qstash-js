import type { RequestHandler } from "@sveltejs/kit";

import type { WorkflowServeParametersWithClient } from "../types";
import { serve as serveBase } from "../serve";

export const serve = <TInitialPayload = unknown>({
  routeFunction,
  options,
  client,
}: WorkflowServeParametersWithClient<TInitialPayload>): RequestHandler => {
  const handler: RequestHandler = ({ request }) => {
    const serveMethod = serveBase<TInitialPayload>({
      routeFunction,
      options: {
        client: client,
        ...options,
      },
    });
    return serveMethod(request);
  };

  return handler;
};
