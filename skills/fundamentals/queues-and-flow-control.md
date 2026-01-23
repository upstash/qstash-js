# Queues and Flow Control

## Queues

Queues provide FIFO (First-In-First-Out) ordered message delivery with configurable parallelism.

### Basic Queue Usage

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

// Enqueue a message
await client.queue({ queueName: "orders" }).enqueueJSON({
  url: "https://api.example.com/process-order",
  body: { orderId: "123", items: ["item1", "item2"] },
});
```

Messages are delivered in order, one at a time by default.

### Ordering Guarantees

- Messages delivered in FIFO order
- Next message waits for current message to be delivered or fail
- Next message waits for callbacks to complete
- Retries don't break ordering (next waits for all retries)

### Configuring Parallelism

Control how many messages process concurrently:

```typescript
// Create or update queue with parallelism
await client.queue({ queueName: "orders" }).upsert({
  parallelism: 5, // Process up to 5 messages concurrently
});

// Then enqueue messages
await client.queue({ queueName: "orders" }).enqueueJSON({
  url: "https://api.example.com/process",
  body: { task: "data" },
});
```

**Note:** Queue parallelism is being deprecated. Use Flow Control for rate limiting (see below).

### Managing Queues

```typescript
// Get queue details
const queue = await client.queue({ queueName: "orders" }).get();
console.log(queue.parallelism);
console.log(queue.lag); // Messages waiting
console.log(queue.paused);

// List all queues
const queues = await client.queue().list();

// Pause queue (stops processing new messages)
await client.queue({ queueName: "orders" }).pause();

// Resume queue
await client.queue({ queueName: "orders" }).resume();

// Delete queue
await client.queue({ queueName: "orders" }).delete();
```

### All Message Options Work

```typescript
await client.queue({ queueName: "orders" }).enqueueJSON({
  url: "https://api.example.com/process",
  body: { order: "data" },
  delay: 60,
  retries: 5,
  timeout: 30,
  callback: "https://api.example.com/callback",
  deduplicationId: "order-123",
});
```

See [Publishing Messages](publishing-messages.md) for all options.

## Flow Control

Control message processing rate and concurrency without queues. More flexible than queue parallelism.

### Basic Flow Control

```typescript
await client.publishJSON({
  url: "https://api.example.com/webhook",
  body: { userId: "user-123", event: "action" },
  flowControl: {
    key: "user-123", // Group messages by key
    parallelism: 2, // Max 2 concurrent requests for this key
    rate: 10, // Max 10 requests
    period: 60, // Per 60 seconds
  },
});
```

### Flow Control Options

**key** (required): Groups messages for rate limiting

- Example: `user-${userId}`, `api-${service}`, `tenant-${tenantId}`

**parallelism** (optional): Max concurrent active requests with same key

- Example: `parallelism: 3` = max 3 requests in-flight

**rate** (optional): Max requests to activate within period

- Example: `rate: 100` with `period: 60` = 100 requests per minute

**period** (optional): Time window for rate limit in seconds or duration string

- Default: `1` (1 second)
- Examples: `60`, `"1m"`, `"5s"`, `"1h"`

## Queues vs Flow Control

**Use Queues when:**

- Need strict FIFO ordering
- Messages must process sequentially
- Single destination with controlled throughput

**Use Flow Control when:**

- Rate limiting by user, tenant, or other key
- Need flexible concurrency control
- No strict ordering required
- Works with any publish/schedule operation

## Best Practices

- Use descriptive queue names: `order-processing`, `email-sending`
- Use descriptive flow control keys: `user-${id}`, `tenant-${id}`
- Start with low parallelism and increase based on capacity
- Monitor queue lag to detect processing bottlenecks
- Use Flow Control for multi-tenant rate limiting
- Pause queues during maintenance, not deletion
- Use deduplication to prevent duplicate enqueues
