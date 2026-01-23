# Receiver - Message Verification

## Overview

The `Receiver` class verifies that incoming requests are genuinely from QStash by validating JWT signatures. This prevents unauthorized requests from reaching your endpoints.

## Getting Your Signing Keys

Sign in to the [Upstash Console](https://console.upstash.com/qstash) and navigate to your QStash instance to find:

- **Current Signing Key**: Active key for signature verification
- **Next Signing Key**: Key to use after rotation

Store these as environment variables:

```bash
QSTASH_CURRENT_SIGNING_KEY="your_current_key"
QSTASH_NEXT_SIGNING_KEY="your_next_key"
```

## Creating a Receiver Instance

### Basic Setup

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});
```

### Multi-Region Mode

If you're using multi-region QStash (with `QSTASH_REGION` environment variable set), signature verification requires additional configuration. The SDK automatically detects the region from the `upstash-region` header and uses region-specific signing keys.

> **Important:** Multi-region signature verification requires careful setup. See [Multi-Region Setup](../advanced/multi-region.md) for complete details on environment variables, region detection, and verification strategies.

## Verifying Incoming Requests

### Basic Verification

```typescript
try {
  await receiver.verify({
    signature: request.headers.get("upstash-signature")!,
    body: await request.text(),
  });

  // Request is valid - process it
  return new Response("OK", { status: 200 });
} catch (error) {
  // Invalid signature
  return new Response("Unauthorized", { status: 401 });
}
```

### With URL Verification

For extra security, verify the request was sent to the correct URL:

```typescript
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  url: "https://my-api.example.com/webhook",
});
```

### With Clock Tolerance

Handle minor clock differences between servers:

```typescript
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  clockTolerance: 5, // Allow 5 seconds difference
});
```

## Required Headers

QStash sends these headers with every request:

- `Upstash-Signature`: JWT signature to verify

> **Note:** In multi-region mode, QStash also sends an `Upstash-Region` header. See [Multi-Region Setup](../advanced/multi-region.md) for details.

## Handling Verification Failures

### SignatureError

The `verify()` method throws `SignatureError` for invalid signatures:

```typescript
import { Receiver, SignatureError } from "@upstash/qstash";

try {
  await receiver.verify({
    signature: request.headers.get("upstash-signature")!,
    body: await request.text(),
  });
} catch (error) {
  if (error instanceof SignatureError) {
    console.error("Invalid signature:", error.message);
    return new Response("Invalid signature", { status: 401 });
  }
  throw error;
}
```

### Common Failure Reasons

1. **Missing or wrong signing keys**
   - Verify keys in Upstash Console match environment variables
2. **Body mismatch**

   - Ensure you pass the raw request body (not parsed JSON)
   - Don't modify the body before verification

3. **Expired signature**

   - QStash signatures expire after 5 minutes
   - Check server clock is synchronized
   - Use `clockTolerance` if needed

4. **URL mismatch**
   - Ensure the `url` parameter matches the destination URL
   - Include protocol, domain, and path

## Key Rotation

The Receiver supports seamless key rotation:

1. Verification tries `currentSigningKey` first
2. If that fails, tries `nextSigningKey`
3. Only throws error if both fail

To rotate keys:

1. Set new key as `QSTASH_NEXT_SIGNING_KEY`
2. Wait for all in-flight requests to complete
3. Update `QSTASH_CURRENT_SIGNING_KEY` to the new key
4. Generate a new `QSTASH_NEXT_SIGNING_KEY`

## Best Practices

### Always Verify

Never trust incoming requests without verification:

```typescript
// ❌ Don't do this
app.post("/webhook", async (req) => {
  const data = await req.json();
  processWebhook(data); // Unverified!
});

// ✅ Do this
app.post("/webhook", async (req) => {
  await receiver.verify({
    signature: req.headers.get("upstash-signature")!,
    body: await req.text(),
  });
  const data = JSON.parse(await req.text());
  processWebhook(data);
});
```

### Use Environment Variables

Never hardcode signing keys:

```typescript
// ❌ Don't do this
const receiver = new Receiver({
  currentSigningKey: "sig_abc123...",
});

// ✅ Do this
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});
```

### Read Body Once

Request bodies can only be read once. Save it for reuse:

```typescript
const body = await request.text();

// Verify with raw body
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body,
});

// Parse after verification
const data = JSON.parse(body);
```

## Platform-Specific Verification

For framework-specific implementations, see:

- [Next.js Verification](platform-specific/nextjs.md)
