# Callbacks

Callbacks let you receive delivery results without waiting for the HTTP request to complete. QStash calls your callback URL with the response after delivering the message.

## Why Use Callbacks?

Serverless functions have execution time limits. Callbacks allow you to:

- Publish long-running tasks without blocking
- Receive delivery confirmation asynchronously
- Handle failures separately with failure callbacks

You can use callbacks individually or together:

```typescript
await client.publishJSON({
  url: "https://api.example.com/webhook",
  body: { order: "12345" },
  callback: "https://api.example.com/callback",
  failureCallback: "https://api.example.com/failure",
});
```

## callback

Called after each delivery attempt (success or failure):

The callback is invoked after every retry attempt until the destination returns a 2XX status or retries are exhausted. Check `retried === maxRetries` in the callback body to detect final failure.

## failureCallback

Called only when all retries are exhausted:

Use this as a serverless alternative to polling the DLQ. See [DLQ](dlq.md) for more options.

## Callback Payload

### Success Callback Body

```json
{
  "status": 200,
  "header": { "content-type": ["application/json"] },
  "body": "YmFzZTY0IGVuY29kZWQgcm9keQ==",
  "retried": 2,
  "maxRetries": 3,
  "sourceMessageId": "msg_xxx",
  "topicName": "myTopic",
  "endpointName": "myEndpoint",
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "sourceHeader": { "content-type": "application/json" },
  "sourceBody": "YmFzZTY0IGVuY29kZWQgcm9keQ==",
  "notBefore": 1701198458025,
  "createdAt": 1701198447054,
  "scheduleId": "scd_xxx",
  "callerIP": "178.247.74.179"
}
```

### Failure Callback Body

```json
{
  "status": 500,
  "header": { "content-type": ["text/plain"] },
  "body": "RXJyb3IgbWVzc2FnZQ==",
  "retried": 3,
  "maxRetries": 3,
  "dlqId": "1725323658779-0",
  "sourceMessageId": "msg_xxx",
  "topicName": "myTopic",
  "endpointName": "myEndpoint",
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "sourceHeader": { "content-type": "application/json" },
  "sourceBody": "YmFzZTY0IGVuY29kZWQgcm9keQ==",
  "notBefore": 1701198458025,
  "createdAt": 1701198447054,
  "scheduleId": "scd_xxx",
  "callerIP": "178.247.74.179"
}
```

### Field Descriptions

- `status` - HTTP status code from destination
- `header` - Response headers from destination
- `body` - Base64-encoded response body (may be truncated per plan limits)
- `retried` - Number of retry attempts made
- `maxRetries` - Maximum retry limit
- `dlqId` - Dead Letter Queue ID (failure callbacks only)
- `sourceMessageId` - Original message ID
- `topicName` - URL group name (if applicable)
- `endpointName` - Endpoint name within URL group (if applicable)
- `url` - Destination URL
- `method` - HTTP method used
- `sourceHeader` - Original message headers
- `sourceBody` - Base64-encoded original message body
- `notBefore` - Scheduled delivery time (Unix ms)
- `createdAt` - Message creation time (Unix ms)
- `scheduleId` - Schedule ID (if from schedule)
- `callerIP` - IP address that published the message

## Callback Configuration

Callbacks are themselves QStash messages and can be configured with the same options. Use the `Upstash-Callback-*` or `Upstash-Failure-Callback-*` header prefix:

**Not available via SDK parameters** - requires custom headers:

```typescript
await client.publish({
  url: "https://api.example.com/webhook",
  body: "data",
  callback: "https://api.example.com/callback",
  headers: {
    // Configure callback behavior
    "Upstash-Callback-Retries": "3",
    "Upstash-Callback-Timeout": "30",
    "Upstash-Callback-Method": "PUT",
    "Upstash-Callback-Delay": "60",

    // Forward custom headers to callback
    "Upstash-Callback-Forward-Authorization": "Bearer token",
    "Upstash-Callback-Forward-X-Custom": "value",

    // Configure failure callback
    "Upstash-Failure-Callback-Retries": "5",
    "Upstash-Failure-Callback-Forward-Authorization": "Bearer token",
  },
});
```

Available configuration headers:

- `Upstash-Callback-Retries` / `Upstash-Failure-Callback-Retries`
- `Upstash-Callback-Timeout` / `Upstash-Failure-Callback-Timeout`
- `Upstash-Callback-Delay` / `Upstash-Failure-Callback-Delay`
- `Upstash-Callback-Method` / `Upstash-Failure-Callback-Method`
- `Upstash-Callback-Forward-*` / `Upstash-Failure-Callback-Forward-*`

## Notes

- Callbacks are charged as regular messages
- Callbacks retry until the callback URL returns 2XX or retries are exhausted
- Response body may be truncated if it exceeds your plan's message size limit
- Both URLs must be publicly accessible
