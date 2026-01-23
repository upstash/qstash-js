# URL Groups

URL Groups (also called Topics) let you publish a single message to multiple endpoints simultaneously.

## Creating URL Groups

Add endpoints to create or update a URL group:

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

await client.urlGroups().addEndpoints({
  name: "payment-webhooks",
  endpoints: [
    { url: "https://api1.example.com/webhook" },
    { url: "https://api2.example.com/webhook" },
    { url: "https://api3.example.com/webhook", name: "primary" },
  ],
});
```

- `name`: URL group identifier (alphanumeric, hyphens, underscores, periods)
- `url`: Endpoint URL (required)
- `name`: Optional endpoint name for identification

## Publishing to URL Groups

Publish once, deliver to all endpoints:

```typescript
const result = await client.publishJSON({
  urlGroup: "payment-webhooks",
  body: { orderId: "123", amount: 99.99, status: "paid" },
});

// Returns array with result for each endpoint
result.forEach((r) => {
  console.log(`Sent to ${r.url}: ${r.messageId}`);
});
```

Each endpoint gets a separate message with its own retry logic and tracking.

## Managing Endpoints

### Remove Endpoints

Remove by URL or name:

```typescript
// Remove by URL
await client.urlGroups().removeEndpoints({
  name: "payment-webhooks",
  endpoints: [{ url: "https://api2.example.com/webhook" }],
});

// Remove by endpoint name
await client.urlGroups().removeEndpoints({
  name: "payment-webhooks",
  endpoints: [{ name: "primary" }],
});
```

### List URL Groups

```typescript
const groups = await client.urlGroups().list();

groups.forEach((group) => {
  console.log(`${group.name}: ${group.endpoints.length} endpoints`);
  group.endpoints.forEach((ep) => {
    console.log(`  - ${ep.url}${ep.name ? ` (${ep.name})` : ""}`);
  });
});
```

### Get Specific URL Group

```typescript
const group = await client.urlGroups().get("payment-webhooks");

console.log(`Created: ${new Date(group.createdAt)}`);
console.log(`Updated: ${new Date(group.updatedAt)}`);
console.log(`Endpoints: ${group.endpoints.length}`);
```

### Delete URL Group

```typescript
await client.urlGroups().delete("payment-webhooks");
```

Deleting a URL group does not affect in-flight messages.

## URL Group vs Individual Publishing

**Use URL Groups when:**

- Broadcasting same message to multiple endpoints
- Need to manage endpoint list centrally
- Adding/removing endpoints dynamically
- All endpoints process the same data

**Use individual publishing when:**

- Each endpoint needs different message content
- Different retry/timeout settings per endpoint
- Endpoints have different purposes

## All Message Options Work

URL Groups support all publishing options:

```typescript
await client.publishJSON({
  urlGroup: "notifications",
  body: { event: "user.signup", userId: "123" },
  delay: 60,
  retries: 5,
  callback: "https://api.example.com/callback",
  deduplicationId: "signup-123",
});
```

See [Publishing Messages](publishing-messages.md) for all options.
