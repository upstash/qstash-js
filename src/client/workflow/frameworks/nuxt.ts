import { defineEventHandler, readRawBody } from "h3";
import type { IncomingHttpHeaders } from "node:http";

import type { WorkflowServeParameters } from "../types";
import { serve as serveBase } from "../serve";

function transformHeaders(headers: IncomingHttpHeaders): [string, string][] {
  const formattedHeaders = Object.entries(headers).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.join(", ") : value ?? "",
  ]);
  return formattedHeaders as [string, string][];
}

export const serve = <TInitialPayload = unknown>({
  routeFunction,
  options,
}: WorkflowServeParameters<TInitialPayload, string>) => {
  const handler = defineEventHandler(async (event) => {
    const method = event.node.req.method;
    if (method?.toUpperCase() !== "POST") {
      return {
        status: 405,
        body: "Only POST requests are allowed in worklfows",
      };
    }

    const request_ = event.node.req;
    const protocol = request_.headers["x-forwarded-proto"];
    const host = request_.headers.host;
    const url = `${protocol}://${host}${event.path}`;
    const headers = transformHeaders(request_.headers);

    const request = new Request(url, {
      headers: headers,
      body: await readRawBody(event),
      method: "POST",
    });

    const serveHandler = serveBase<TInitialPayload, Request, string>({
      routeFunction,
      options: {
        onStepFinish: (workflowRunId: string) => workflowRunId,
        ...options,
      },
    });
    try {
      const workflowRunId = await serveHandler(request);
      return {
        status: 200,
        body: { workflowRunId },
      };
    } catch (error) {
      return {
        status: 500,
        body: `Error running the workflow at URL '${url}'. Got error: ${error}`,
      };
    }
  });
  return handler;
};
