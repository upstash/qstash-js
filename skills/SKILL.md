---
name: qstash-js
description: Work with the QStash JavaScript/TypeScript SDK for serverless messaging, scheduling. Use when publishing messages to HTTP endpoints, creating schedules, managing queues, verifying incoming messages in serverless environments.
---

# QStash JavaScript SDK

QStash is an HTTP-based messaging and scheduling solution for serverless and edge runtimes. This skill helps you use the QStash JS SDK effectively.

## When to use this skill

Use this skill when:

- Publishing HTTP messages to endpoints or URL groups
- Creating scheduled or delayed message delivery
- Managing FIFO queues with configurable parallelism
- Verifying incoming webhook signatures from QStash
- Working with multi-region QStash deployments
- Implementing callbacks, DLQ handling, or message deduplication

## Quick Start

### Installing the SDK

```bash
npm install @upstash/qstash
```

### Basic Publishing

```typescript
import { Client } from "@upstash/qstash";

const client = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const result = await client.publishJSON({
  url: "https://my-api.example.com/webhook",
  body: { event: "user.created", userId: "123" },
});
```

## Core Concepts

For fundamental QStash operations, see:

- [Publishing Messages](fundamentals/publishing-messages.md)
- [Schedules](fundamentals/schedules.md)
- [Queues and Flow Control](fundamentals/queues-flow-control.md)
- [URL Groups](fundamentals/url-groups.md)

For verifying incoming messages:

- [Receiver Verification](verification/receiver.md) - Core signature verification with the Receiver class
- Platform-Specific Verifiers:
  - [Next.js](verification/platform-specific/nextjs.md) - App Router, Pages Router, and Edge Runtime

For advanced features:

- [Multi-Region Setup](advanced/multi-region.md)
- [Callbacks](advanced/callbacks.md)
- [Dead Letter Queue (DLQ)](advanced/dlq.md)
- [Message Deduplication](advanced/deduplication.md)

## Platform Support

QStash JS SDK works across various platforms:

- Next.js (App Router and Pages Router)
- Cloudflare Workers
- Deno
- Node.js (v18+)
- Vercel Edge Runtime
- SvelteKit, Nuxt, SolidJS, and other frameworks

> **Note on Workflow SDK:** For building complex durable workflows that chain multiple QStash messages together, consider using the separate QStash Workflow SDK (`@upstash/workflow`). The Workflow SDK empowers you to orchestrate multi-step processes with automatic state management, retries, and fault tolerance. This Skills file focuses on the core QStash messaging SDK.

## Best Practices

- Always verify incoming QStash messages using the Receiver class
- Use environment variables for tokens and signing keys
- Set appropriate retry counts and timeouts for your use case
- Use queues for ordered processing with controlled parallelism
- Implement DLQ handling for failed message recovery
