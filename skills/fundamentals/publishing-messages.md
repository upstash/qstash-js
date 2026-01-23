# Publishing Messages

Publish HTTP messages to destinations using the QStash SDK. Messages are delivered asynchronously with built-in retries and monitoring.

## Basic Publishing

### publishJSON()

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

const result = await client.publishJSON({
  url: "https://api.example.com/webhook",
  body: { userId: "123", event: "order.completed" },
});

console.log(result.messageId); // "msg_123..."
```

## Destination Options

Specify where to send the message using one of these mutually exclusive options:

```typescript
await client.publishJSON({
  // Send to a single HTTP endpoint:
  url: "https://api.example.com/webhook",
  // Send to all endpoints in a URL group. Creates one message per endpoint:
  // Learn more in [URL Groups](url-groups.md).
  urlGroup: "my-api-group",
  // ...
});
```

## Message Options

```typescript
// JSON object
await client.publishJSON({
  url: "https://api.example.com/webhook",
  // request body
  body: { reminder: "Check status" },
  // The message payload
  body: { order_id: "123", items: [1, 2, 3] },
  // Send to a FIFO queue for ordered processing:
  // Learn more in [Queues and Flow Control](queues-and-flow-control.md).
  queueName: "my-fifo-queue",
  // Send with a flow control key to limit rate/parallelism:
  flowControl: {
    key: "user-123",
    parallelism: 2,
    rate: 10,
    period: 60,
  },
  // request headers
  headers: {
    "Content-Type": "application/json",
    "X-Custom-Header": "value",
    Authorization: "Bearer token", // auth token for the destination
  },
  // request method
  method: "PUT",
  // Delay message delivery by a duration in seconds:
  delay: 60,
  // alternative of delay, deliver at a specific Unix timestamp in seconds:
  notBefore: 1700000000,
  // retries
  retries: 10,
  // Customize the delay between retries using a mathematical expression.
  // Default is exponential backoff.
  // Supported functions: `pow`, `sqrt`, `abs`, `exp`, `floor`, `ceil`, `round`, `min`, `max`.
  retryDelay: "5000",
  // Maximum duration for the HTTP request in seconds:
  timeout: 15,
  // URL called if the message is successfully delivered:
  callback: "https://api.example.com/qstash-callback",
  // URL called only when all retries are exhausted:
  failureCallback: "https://api.example.com/failure-handler",
  // id for deduplicating messages
  deduplicationId: "custom-id-123",
  // enable content-based deduplication
  contentBasedDeduplication: true,
  // label for filtering logs, dlq, cancellation
  label: "order-webhook",
});
```

## Batch Publishing

Publish multiple messages in a single request:

```typescript
const results = await client.batchJSON([
  {
    url: "https://api.example.com/webhook-1",
    body: { event: "first" },
  },
  {
    url: "https://api.example.com/webhook-2",
    body: { event: "second" },
    delay: 60,
  },
  {
    urlGroup: "my-group",
    body: { event: "third" },
  },
]);
```

Each message in the batch can have different options.

## Response Types

### Single URL

When publishing to a `url`, response contains:

```typescript
{
  messageId: string;    // Unique message identifier
  url: string;          // Destination URL
  deduplicated?: boolean; // true if message was deduplicated
}
```

### URL Group

When publishing to a `urlGroup`, response contains an array:

```typescript
[
  {
    messageId: string;
    url: string;          // First endpoint URL
    deduplicated?: boolean;
  },
  {
    messageId: string;
    url: string;          // Second endpoint URL
    deduplicated?: boolean;
  },
  // ... one per endpoint
]
```
