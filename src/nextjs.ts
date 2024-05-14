import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextFetchEvent, NextResponse } from "next/server";
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

  return async (req: NextApiRequest, res: NextApiResponse) => {
    // @ts-ignore This can throw errors during vercel build
    const signature = req.headers["upstash-signature"];
    if (!signature) {
      res.status(400);
      res.send("`Upstash-Signature` header is missing");
      res.end();
      return;
    }
    if (typeof signature !== "string") {
      throw new Error("`Upstash-Signature` header is not a string");
    }

    const chunks = [];
    for await (const chunk of req) {
      // @ts-ignore
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks).toString("utf-8");

    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      res.status(400);
      res.send("Invalid signature");
      res.end();
      return;
    }

    try {
      if (req.headers["content-type"] === "application/json") {
        req.body = JSON.parse(body);
      } else {
        req.body = body;
      }
    } catch {
      req.body = body;
    }

    return handler(req, res);
  };
}

export function verifySignatureEdge(
  handler: (req: NextRequest, nfe?: NextFetchEvent) => NextResponse | Promise<NextResponse>,
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

  return async (req: NextRequest, nfe: NextFetchEvent) => {
    const reqClone = req.clone();
    // @ts-ignore This can throw errors during vercel build
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return new NextResponse(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new Error("`Upstash-Signature` header is not a string");
    }

    const body = await req.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new NextResponse(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(new NextRequest(req), nfe);
  };
}

type VerifySignatureAppRouterResponse = NextResponse | Promise<NextResponse>;

export function verifySignatureAppRouter(
  handler:
    | ((req: Request) => VerifySignatureAppRouterResponse)
    | ((req: NextRequest) => VerifySignatureAppRouterResponse),
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

  return async (req: NextRequest | Request) => {
    const reqClone = req.clone();
    // @ts-ignore This can throw errors during vercel build
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return new NextResponse(new TextEncoder().encode("`Upstash-Signature` header is missing"), {
        status: 403,
      });
    }
    if (typeof signature !== "string") {
      throw new Error("`Upstash-Signature` header is not a string");
    }

    const body = await req.text();
    const isValid = await receiver.verify({
      signature,
      body,
      clockTolerance: config?.clockTolerance,
    });
    if (!isValid) {
      return new NextResponse(new TextEncoder().encode("invalid signature"), { status: 403 });
    }

    return handler(new NextRequest(req));
  };
}
