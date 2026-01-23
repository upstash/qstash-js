# Next.js Endpoint Verification

## Overview

Next.js applications can use QStash in both App Router (route handlers) and Pages Router (API routes). The SDK provides dedicated verification utilities for each.

## App Router Verification

### Using verifySignatureAppRouter

The SDK provides `verifySignatureAppRouter` for App Router route handlers:

```typescript
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

// app/api/webhook/route.ts
export const POST = verifySignatureAppRouter(async (req) => {
  const body = await req.json();

  // Request is verified - process it
  console.log("Received verified message:", body);

  return new Response("OK", { status: 200 });
});
```

### With Custom Configuration

```typescript
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const POST = verifySignatureAppRouter(
  async (req) => {
    const body = await req.json();
    return Response.json({ received: true });
  },
  {
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    clockTolerance: 5, // Allow 5 seconds clock difference
  }
);
```

### Multi-Region Support

```typescript
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const POST = verifySignatureAppRouter(async (req) => {
  const upstashRegion = req.headers.get("upstash-region");
  console.log("Request from region:", upstashRegion);

  const body = await req.json();
  return Response.json({ region: upstashRegion, data: body });
});
```

## Pages Router Verification

### Using verifySignature

For Pages Router API routes, use the `verifySignature` wrapper:

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignature } from "@upstash/qstash/nextjs";

// pages/api/webhook.ts
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body;

  // Request is verified
  console.log("Received:", body);

  res.status(200).json({ success: true });
}

export default verifySignature(handler);
```

### With Configuration

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignature } from "@upstash/qstash/nextjs";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ message: "Verified" });
}

export default verifySignature(handler, {
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  clockTolerance: 5,
});
```

## Manual Verification with Receiver

For more control, use the `Receiver` class directly:

### Manual Verification

```typescript
import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  const signature = req.headers.get("upstash-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await req.text();

  try {
    await receiver.verify({
      signature,
      body,
      url: req.url,
    });

    // Verified - parse and process
    const data = JSON.parse(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
}
```

## Best Practices

### Handle Errors Gracefully

```typescript
export const POST = verifySignatureAppRouter(async (req) => {
  try {
    const body = await req.json();
    await processWebhook(body);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Processing error:", error);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
});
```

## Common Issues

### Missing Environment Variables

```typescript
if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
  throw new Error("Missing QSTASH_CURRENT_SIGNING_KEY");
}
```

## Related Resources

- [General Receiver Documentation](../receiver.md)
- [Multi-Region Setup](../../advanced/multi-region.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Deployment](https://vercel.com/docs)
