/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { NextRequest, type NextFetchEvent, NextResponse } from "next/server";
import { Receiver } from "./receiver";

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
  handler: (request: NextRequest, nfe?: NextFetchEvent) => NextResponse | Promise<NextResponse>,
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
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return new NextResponse(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await request.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new NextResponse(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(new NextRequest(request), nfe);
  };
}

type VerifySignatureAppRouterResponse =
  | NextResponse
  | Promise<NextResponse>
  | Response
  | Promise<Response>;

export function verifySignatureAppRouter(
  handler:
    | ((request: Request) => VerifySignatureAppRouterResponse)
    | ((request: NextRequest) => VerifySignatureAppRouterResponse),
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

  return async (request: NextRequest | Request) => {
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return new NextResponse(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new TypeError("`Upstash-Signature` header is not a string");
    }

    const body = await request.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new NextResponse(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(new NextRequest(request));
  };
}
