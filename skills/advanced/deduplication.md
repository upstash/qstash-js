# Message Deduplication

Prevent duplicate message delivery within a 90-day window using deduplication IDs.

## Why Deduplication?

Duplicate messages can occur when:

- User retries a failed request
- Network issues cause message resubmission
- Application logic triggers multiple publishes for the same event

Deduplication ensures QStash accepts but doesn't enqueue duplicate messages.

## Deduplication Methods

### deduplicationId

Provide a custom identifier to detect duplicates:

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

await client.publishJSON({
  url: "https://api.example.com/webhook",
  deduplicationId: `order-${orderId}-payment`,
  body: { orderId, status: "paid" },
});
```

If a message with the same `deduplicationId` was published in the last 90 days, the new message is accepted but not enqueued.

**Use cases:**

- Order processing: `order-${orderId}`
- User events: `user-${userId}-signup`
- Payment transactions: `payment-${transactionId}`

### contentBasedDeduplication

Automatically generate a deduplication ID from message content:

```typescript
await client.publishJSON({
  url: "https://api.example.com/webhook",
  contentBasedDeduplication: true,
  body: { userId: "123", event: "signup" },
});
```

The hash includes:

- All headers (except authorization)
- Request body
- Destination URL

## Deduplication Window

Deduplication IDs are stored for **90 days**. After this period, a message with the same ID can be delivered again.

## Response Handling

When a duplicate is detected, the response includes the original message ID:

```typescript
const result = await client.publishJSON({
  url: "https://api.example.com/webhook",
  deduplicationId: "order-123",
  body: { order: "data" },
});

if (result.deduplicated) {
  console.log("Duplicate detected");
  console.log("Original message ID:", result.messageId);
}
```

## Best Practices

- Use descriptive, deterministic deduplication IDs
- Include relevant context in custom IDs: `${entity}-${id}-${action}`
- Don't rely on deduplication for critical data consistency
- Monitor deduplicated messages in logs to detect issues
- Document your deduplication strategy for team reference
