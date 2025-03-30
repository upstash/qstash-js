/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { type NextRequest } from "next/server";
import { type NextFetchEvent } from "next/server";
import { Receiver } from "../src/receiver";

import type { WorkflowServeOptions, RouteFunction } from "../src/client/workflow";
import { serve as serveBase } from "../src/client/workflow";

export type VerifySignatureConfig = {
  currentSigningKey?: string;
  nextSigningKey?: string;

  /**
   * The url of this api route, including the protocol.
   *
   * If you omit this, the url will be automatically determined by checking the `VERCEL_URL` env variable and assuming `https`
   */
  url?: string;

  /**
   * Number of seconds to tolerate when checking `nbf` and `exp` claims, to deal with small clock differences among different servers
   *
   * @default 0
   */
  clockTolerance?: number;
};

const BAD_REQUEST = 400;

export function verifySignature(
  handler: NextApiHandler,
  config?: VerifySignatureConfig
): NextApiHandler {
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

  return async (request: NextApiRequest, response: NextApiResponse) => {
    // @ts-ignore This can throw errors during vercel build
    const signature = request.headers["upstash-signature"];
    if (!signature) {
      response.status(BAD_REQUEST);
      response.send("`Upstash-Signature` header is missing");
      response.end();
      return;
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks).toString("utf8");

    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      response.status(BAD_REQUEST);
      response.send("Invalid signature");
      response.end();
      return;
    }

    try {
      request.body = (
        request.headers["content-type"] === "application/json" ? JSON.parse(body) : body
      ) as string;
    } catch {
      request.body = body;
    }

    return handler(request, response);
  };
}

export function verifySignatureEdge(
  handler: (request: NextRequest, nfe?: NextFetchEvent) => Response | Promise<Response>,
  config?: VerifySignatureConfig
) {
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

  return async (request: NextRequest, nfe: NextFetchEvent) => {
    // @ts-ignore This can throw errors during vercel build
    const requestClone = request.clone() as NextRequest;
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return new Response(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await requestClone.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new Response(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(request, nfe);
  };
}

type VerifySignatureAppRouterResponse = Response | Promise<Response>;

export function verifySignatureAppRouter(
  handler:
    | ((request: Request, params?: any) => VerifySignatureAppRouterResponse)
    | ((request: NextRequest, params?: any) => VerifySignatureAppRouterResponse),
  config?: VerifySignatureConfig
) {
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

  return async (request: NextRequest | Request, params?: any) => {
    const requestClone = request.clone() as NextRequest;
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return new Response(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await requestClone.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new Response(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(request as NextRequest, params);
  };
}

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
  options?: Omit<WorkflowServeOptions<Response, TInitialPayload>, "onStepFinish">
): ((request: Request) => Promise<Response>) => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const handler = serveBase<TInitialPayload>(routeFunction, {
    onStepFinish: (workflowRunId: string) =>
      new Response(JSON.stringify({ workflowRunId }), { status: 200 }),
    ...options,
  });

  return async (request: Request) => {
    return await handler(request);
  };
};

/**
 * @deprecated as of version 2.7.17. Will be removed in qstash-js 3.0.0.
 * Please use https://github.com/upstash/workflow-js
 * Migration Guide: https://upstash.com/docs/workflow/migration
 */
export const servePagesRouter = <TInitialPayload = unknown>(
  routeFunction: RouteFunction<TInitialPayload>,
  options?: Omit<WorkflowServeOptions<Response, TInitialPayload>, "onStepFinish">
): NextApiHandler => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const handler = serveBase(routeFunction, options);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method?.toUpperCase() !== "POST") {
      res.status(405).json("Only POST requests are allowed in worklfows");
      return;
    } else if (!req.url) {
      res.status(400).json("url not found in the request");
      return;
    }

    const protocol = req.headers["x-forwarded-proto"];
    const baseUrl = options?.baseUrl ?? `${protocol}://${req.headers.host}`;

    const request = new Request(options?.url ?? `${baseUrl}${req.url}`, {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      body: JSON.stringify(req.body) ?? "",
      headers: new Headers(req.headersDistinct as Record<string, string[]>),
      method: "POST",
    });
    const response = await handler(request);
    res.status(response.status).json(await response.json());
  };
};
