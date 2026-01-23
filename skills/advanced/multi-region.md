# Multi-Region Setup

## Overview

QStash supports multi-region deployments across EU (EU_CENTRAL_1) and US (US_EAST_1) regions.

## Requirements

Multi-region support requires minimum SDK versions:

- `@upstash/qstash` >= 2.9.0
- `@upstash/workflow` >= 1.1.0 (if using workflows)

Update your dependencies:

```bash
npm install @upstash/qstash@latest
# or if using workflows
npm install @upstash/qstash@latest @upstash/workflow@latest
```

## When to Use Multi-Region

Consider multi-region QStash when:

- You're migrating from one region to another

## Understanding Multi-Region Mode

Multi-region mode is activated by setting the `QSTASH_REGION` environment variable to your primary region (`EU_CENTRAL_1` or `US_EAST_1`). When active:

- **Outgoing messages** use region-specific credentials
- **Incoming messages** are verified using region-specific signing keys
- The SDK automatically handles region detection

## Environment Variable Setup

### Single-Region Setup (Default)

For single-region deployments (EU only):

```bash
# Outgoing messages
QSTASH_TOKEN="your_token"

# Incoming message verification (optional)
QSTASH_CURRENT_SIGNING_KEY="your_current_key"
QSTASH_NEXT_SIGNING_KEY="your_next_key"
```

Optionally specify a custom URL:

```bash
QSTASH_URL="https://qstash.upstash.io"  # EU region (default)
QSTASH_TOKEN="your_token"
QSTASH_CURRENT_SIGNING_KEY="your_current_key"
QSTASH_NEXT_SIGNING_KEY="your_next_key"
```

### Multi-Region Setup

For multi-region deployments with US as primary:

```bash
# Enable multi-region mode with US as primary
QSTASH_REGION="US_EAST_1"

# Outgoing messages - US region (primary)
US_EAST_1_QSTASH_URL="https://qstash-us-east-1.upstash.io"
US_EAST_1_QSTASH_TOKEN="your_us_token"

# Outgoing messages - EU region (only needed for Upstash Workflow)
EU_CENTRAL_1_QSTASH_URL="https://qstash.upstash.io"
EU_CENTRAL_1_QSTASH_TOKEN="your_eu_token"

# (Optional) Incoming message verification - US region
US_EAST_1_QSTASH_CURRENT_SIGNING_KEY="your_us_current_key"
US_EAST_1_QSTASH_NEXT_SIGNING_KEY="your_us_next_key"

# (Optional) Incoming message verification - EU region
EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY="your_eu_current_key"
EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY="your_eu_next_key"
```

For multi-region with EU as primary, set `QSTASH_REGION="EU_CENTRAL_1"`.

### Getting Region-Specific Credentials

Sign in to the [Upstash Console](https://console.upstash.com/qstash) to find:

- **US Region**: `https://qstash-us-east-1.upstash.io`
- **EU Region**: `https://qstash.upstash.io`

Each region has its own:

- API token for outgoing requests
- Signing keys for incoming request verification

You can get all envrionment variables required for multi region setup using the `Migrate` button in the region list page.

## How Outgoing Messages Work

### Single-Region Mode

When `QSTASH_REGION` is not set:

1. SDK reads `QSTASH_URL` and `QSTASH_TOKEN`
2. If `QSTASH_URL` is not set, defaults to EU region
3. All messages are published through this region

```typescript
import { Client } from "@upstash/qstash";

// Uses QSTASH_TOKEN and QSTASH_URL (or EU default)
const client = new Client({
  token: process.env.QSTASH_TOKEN!,
});

await client.publishJSON({
  url: "https://my-api.com/webhook",
  body: { message: "hello" },
});
```

### Multi-Region Mode

When `QSTASH_REGION` is set to a valid region:

1. SDK reads region-specific credentials (e.g., `US_EAST_1_QSTASH_URL`)
2. All messages are published through the specified primary region
3. If region-specific credentials are missing, falls back to default credentials with a warning

```typescript
import { Client } from "@upstash/qstash";

// Automatically uses US_EAST_1_QSTASH_TOKEN and US_EAST_1_QSTASH_URL
// based on QSTASH_REGION="US_EAST_1"
const client = new Client();

await client.publishJSON({
  url: "https://my-api.com/webhook",
  body: { message: "hello" },
});
```

### Credential Resolution Priority

The SDK resolves credentials in this order:

1. **Config overrides**: Explicitly passed `token` and `baseUrl`
2. **Region-specific**: Based on `QSTASH_REGION` (e.g., `US_EAST_1_QSTASH_TOKEN`)
3. **Default credentials**: `QSTASH_TOKEN` and `QSTASH_URL`
4. **Default URL**: `https://qstash.upstash.io` (EU) with token from environment

```typescript
// Override with explicit credentials
const client = new Client({
  token: "custom_token",
  baseUrl: "https://qstash-us-east-1.upstash.io",
});
```

## How Incoming Messages Work

### Understanding the Region Header

QStash includes an `upstash-region` header with every request indicating the source region:

```
upstash-region: US-EAST-1
```

The SDK uses this header to determine which signing keys to use for verification.

### Single-Region Verification

In single-region mode, the SDK uses default signing keys:

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
});
```

### Multi-Region Verification

In multi-region mode, the SDK:

1. Checks the `upstash-region` header from the request
2. Normalizes it (converts `US-EAST-1` → `US_EAST_1`)
3. Looks for region-specific signing keys (e.g., `US_EAST_1_QSTASH_CURRENT_SIGNING_KEY`)
4. Falls back to default keys if region-specific keys are missing

```typescript
import { Receiver } from "@upstash/qstash";

// Auto-detects region from QSTASH_REGION environment
const receiver = new Receiver();

await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  upstashRegion: request.headers.get("upstash-region") ?? undefined,
});
```

### Signing Key Resolution Priority

The SDK resolves signing keys in this order:

1. **Config overrides**: Explicitly passed signing keys
2. **Region-specific**: Based on `upstash-region` header (e.g., `US_EAST_1_QSTASH_CURRENT_SIGNING_KEY`)
3. **Default keys**: `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`

### Platform-Specific Verification

On most platforms, verifiers automatically handle multi-region verification.

```typescript
// Next.js App Router
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

export const POST = verifySignatureAppRouter(async (req) => {
  // Automatically handles multi-region verification
  const body = await req.json();
  return Response.json({ success: true });
});
```

In cloudflare workers, it's not possible right now but it will be supported in the future.

## Migration from Single to Multi-Region

### Step-by-Step Migration

#### Step 1: Add Multi-Region Credentials

Keep your existing credentials and add region-specific ones:

```bash
# Existing (keep these)
QSTASH_TOKEN="your_eu_token"
QSTASH_CURRENT_SIGNING_KEY="your_eu_current_key"
QSTASH_NEXT_SIGNING_KEY="your_eu_next_key"

# New multi-region credentials
QSTASH_REGION="US_EAST_1"  # Set your primary region

US_EAST_1_QSTASH_URL="https://qstash-us-east-1.upstash.io"
US_EAST_1_QSTASH_TOKEN="your_us_token"
US_EAST_1_QSTASH_CURRENT_SIGNING_KEY="your_us_current_key"
US_EAST_1_QSTASH_NEXT_SIGNING_KEY="your_us_next_key"

EU_CENTRAL_1_QSTASH_URL="https://qstash.upstash.io"
EU_CENTRAL_1_QSTASH_TOKEN="your_eu_token"  # Can reuse existing
EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY="your_eu_current_key"
EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY="your_eu_next_key"
```

#### Step 2: Update Verification Code

Add region header to verification calls:

```typescript
// Before (single-region)
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
});

// After (multi-region ready)
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  upstashRegion: request.headers.get("upstash-region") ?? undefined,
});
```

#### Step 3: Verify Setup

Use the verification script to confirm your env variable setup:

```bash
npx tsx skills/advanced/scripts/verify-multi-region-setup.ts
```

## Troubleshooting

### Common Issues

#### "No signing keys available for verification"

**Cause**: Neither default nor region-specific signing keys are found.

**Solution**: Verify environment variables are set:

```bash
# Single-region
echo $QSTASH_CURRENT_SIGNING_KEY
echo $QSTASH_NEXT_SIGNING_KEY

# Multi-region
echo $QSTASH_REGION
echo $US_EAST_1_QSTASH_CURRENT_SIGNING_KEY
echo $US_EAST_1_QSTASH_NEXT_SIGNING_KEY
```

## Best Practices

### Always Pass Region Header

When verifying in multi-region mode, always pass the `upstash-region` header:

```typescript
// ✅ Good - region-aware verification
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  upstashRegion: request.headers.get("upstash-region") ?? undefined,
});

// ⚠️ Works but may use wrong keys in multi-region
await receiver.verify({
  signature: request.headers.get("upstash-signature")!,
  body: await request.text(),
  // Missing upstashRegion - will use default keys
});
```

### Test Both Regions

When setting up multi-region, test messages from both regions:

```bash
# Trigger messages from US region
curl -X POST https://qstash-us-east-1.upstash.io/v2/publish/... \
  -H "Authorization: Bearer $US_EAST_1_QSTASH_TOKEN"

# Trigger messages from EU region
curl -X POST https://qstash.upstash.io/v2/publish/... \
  -H "Authorization: Bearer $EU_CENTRAL_1_QSTASH_TOKEN"
```

### Gradual Migration

Migrate gradually to minimize risk:

1. Add multi-region credentials alongside existing ones
2. Update verification code to handle region header
3. Test in staging environment
4. Activate multi-region mode in production
5. Monitor for warnings and errors

## Verification Script

Use the provided script to verify your environment setup:

```bash
# Option 1: Using bun (automatically loads .env)
bun run skills/advanced/scripts/verify-multi-region-setup.ts

# Option 2: Using tsx with dotenv
npm install dotenv
npx tsx -r dotenv/config skills/advanced/scripts/verify-multi-region-setup.ts
```

The script checks:

- Whether setup is single-region or multi-region
- Which region will be used for outgoing messages
- Whether all required environment variables are present
- If there are any configuration issues

See [scripts/verify-multi-region-setup.ts](scripts/verify-multi-region-setup.ts) for implementation details.

## Related Documentation

- [Receiver Verification](../verification/receiver.md) - Basic signature verification
- [Client Setup](../fundamentals/client-setup.md) - Client initialization
- [Platform-Specific Verification](../verification/platform-specific/) - Framework-specific guides
