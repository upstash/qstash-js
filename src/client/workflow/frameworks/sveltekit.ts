import type { RequestHandler } from "@sveltejs/kit";

import type { WorkflowServeOptions, WorkflowServeParameters } from "../types";
import { serve as serveBase } from "../serve";
import type { Client } from "../../..";

/**
 * In the SvelteKit parameters, we require the user to pass a QStash client explicitly.
 *
 * This is required because we can't import env variables unless we install vite
 * to the project.
 */
type SveltekitServeParameters<
  TInitialPayload = unknown,
  TResponse extends Response = Response,
> = WorkflowServeParameters<TInitialPayload> & {
  client: Client;
  options?: Omit<WorkflowServeOptions<TResponse, TInitialPayload>, "client">;
};

export const serve = <TInitialPayload>({
  routeFunction,
  options,
  client,
}: SveltekitServeParameters<TInitialPayload>): RequestHandler => {
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
