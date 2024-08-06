import type { RequestHandler } from "@sveltejs/kit";

import type { WorkflowServeParametersExtended } from "../types";
import { serve as serveBase } from "../serve";

export const serve = <TInitialPayload = unknown>({
  routeFunction,
  options,
  receiver,
  client,
}: WorkflowServeParametersExtended<TInitialPayload>): RequestHandler => {
  const handler: RequestHandler = ({ request }) => {
    const serveMethod = serveBase<TInitialPayload>({
      routeFunction,
      options: {
        client,
        receiver,
        ...options,
      },
    });
    return serveMethod(request);
  };

  return handler;
};
