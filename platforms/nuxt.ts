import type { H3Event } from "h3";
import { defineEventHandler, getHeader, readRawBody } from "h3";
import { formatWorkflowError, Receiver } from "../src";

import type { WorkflowServeParameters } from "../src/client/workflow";
import { serve as serveBase } from "../src/client/workflow";
import type { IncomingHttpHeaders } from "node:http";

type VerifySignatureConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
};

export const verifySignatureNuxt = (
  handler: (event: H3Event) => Promise<unknown>,
  config?: VerifySignatureConfig
) => {
  const currentSigningKey = config?.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) {
    throw new Error(
      "currentSigningKey is required, either in the config or as env variable QSTASH_CURRENT_SIGNING_KEY"
    );
  }
  const nextSigningKey = config?.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!nextSigningKey) {
    throw new Error(
      "nextSigningKey is required, either in the config or as env variable QSTASH_NEXT_SIGNING_KEY"
    );
  }
  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });

  return defineEventHandler(async (event: H3Event) => {
    const signature = getHeader(event, "upstash-signature");
    if (!signature) {
      return { status: 403, body: "`Upstash-Signature` header is missing" };
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await readRawBody(event);
    const isValid = await receiver.verify({
      signature,
      body: JSON.stringify(body),
      clockTolerance: config?.clockTolerance,
    });

    if (!isValid) {
      return { status: 403, body: "invalid signature" };
    }

    event._requestBody = body;

    return handler(event);
  });
};

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
}: WorkflowServeParameters<TInitialPayload, Response, "onStepFinish">) => {
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

    const serveHandler = serveBase<TInitialPayload>({
      routeFunction,
      options,
    });
    try {
      return await serveHandler(request);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify(formatWorkflowError(error)), { status: 500 });
    }
  });
  return handler;
};
