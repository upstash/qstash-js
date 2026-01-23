# Dead Letter Queue (DLQ)

Messages that fail after all retries are moved to the Dead Letter Queue for manual inspection and recovery.

## What is the DLQ?

When a message fails delivery after exhausting all retries, QStash moves it to the DLQ instead of discarding it. This lets you:

- Investigate failure reasons
- Manually retry after fixing issues
- Delete permanently failed messages
- Track patterns in failures

Common failure reasons:

- Destination endpoint errors (5XX responses)
- Timeouts
- Network issues
- Invalid responses from destination

## Listing DLQ Messages

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

const result = await client.dlq.listMessages();

console.log(`Found ${result.messages.length} failed messages`);

result.messages.forEach((msg) => {
  console.log(`Message ${msg.messageId} to ${msg.url}`);
  console.log(`Status: ${msg.responseStatus}`);
  console.log(`DLQ ID: ${msg.dlqId}`);
});
```

## Pagination

Use cursor-based pagination for large DLQ:

```typescript
let cursor: string | undefined;
const allMessages = [];

do {
  const result = await client.dlq.listMessages({
    cursor,
    count: 50, // Return up to 50 messages
  });
  allMessages.push(...result.messages);
  cursor = result.cursor;
} while (cursor);

console.log(`Total failed messages: ${allMessages.length}`);
```

## Filtering DLQ Messages

Filter by various criteria:

```typescript
const result = await client.dlq.listMessages({
  filter: {
    messageId: "msg_123...",
    url: "https://api.example.com/webhook",
    urlGroup: "payment-webhooks",
    queueName: "order-processing",
    scheduleId: "scd_123...",
    label: "payment-processing",
    responseStatus: 500,
    fromDate: oneDayAgo,
    toDate: Date.now(),
    callerIp: "192.168.1.1",
  },
});
```

## Message Details

Each DLQ message includes:

```typescript
type DlqMessage = {
  dlqId: string; // Unique DLQ identifier
  messageId: string; // Original message ID
  url: string; // Destination URL
  method?: string; // HTTP method
  header?: Record<string, string[]>; // Request headers
  body?: string; // Request body
  urlGroup?: string; // URL group name
  queueName?: string; // Queue name
  scheduleId?: string; // Schedule ID
  createdAt: number; // Creation timestamp (ms)
  notBefore?: number; // Scheduled delivery time (ms)
  label?: string; // Message label

  // Failure details
  responseStatus?: number; // HTTP status from destination
  responseHeader?: Record<string, string[]>; // Response headers
  responseBody?: string; // Response body (UTF-8)
  responseBodyBase64?: string; // Response body (base64 if non-UTF-8)
};
```

## Deleting Messages

```typescript
await client.dlq.delete("1725323658779-0");
await client.dlq.deleteMany({
  dlqIds: ["1725323658779-0", "1725323658780-1", "1725323658781-2"],
});
```

## Understanding Failures

Inspect failure details:

```typescript
const result = await client.dlq.listMessages();

for (const msg of result.messages) {
  console.log(`\nMessage ${msg.messageId}:`);
  console.log(`URL: ${msg.url}`);
  console.log(`Status: ${msg.responseStatus}`);

  if (msg.responseBody) {
    console.log(`Response: ${msg.responseBody}`);
  } else if (msg.responseBodyBase64) {
    const decoded = Buffer.from(msg.responseBodyBase64, "base64").toString();
    console.log(`Response: ${decoded}`);
  }

  if (msg.responseHeader) {
    console.log(`Headers:`, msg.responseHeader);
  }
}
```

## Using Failure Callbacks

Instead of polling the DLQ, use failure callbacks for real-time notifications:

See [Callbacks](callbacks.md) for more details.

## DLQ Retention

Messages remain in the DLQ based on your plan:

- **Free**: 7 days
- **Paid**: Check your plan on [QStash Pricing](https://upstash.com/pricing/qstash)

Messages are automatically deleted when retention expires.

## Best Practices

- Set up failure callbacks for critical messages
- Regularly monitor DLQ for patterns
- Delete non-retriable messages to keep DLQ clean
- Use labels to categorize and filter failures
- Alert on DLQ message count thresholds
- Document common failure scenarios and resolutions
- Consider automated retries for known transient issues
