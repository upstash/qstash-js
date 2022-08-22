# Upstash QStash SDK

[![Tests](https://github.com/upstash/sdk-qstash-ts/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/sdk-qstash-ts/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/redis)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/@upstash/redis)

**QStash** is an HTTP based messaging and scheduling solution for serverless and
edge runtimes.

It is 100% built on stateless HTTP requests and designed for:

- Serverless functions (AWS Lambda ...)
- Cloudflare Workers (see
  [the example](https://github.com/upstash/sdk-qstash-ts/tree/main/examples/cloudflare-workers))
- Fastly Compute@Edge
- Next.js, including [edge](https://nextjs.org/docs/api-reference/edge-runtime)
- Deno
- Client side web/mobile applications
- WebAssembly
- and other environments where HTTP is preferred over TCP.

See
[the list of APIs](https://docs.upstash.com/features/restapi#rest---redis-api-compatibility)
supported.

## Status of the SDK

It is currently in beta and we are actively collecting feedback from the
community. Please report any issues you encounter or feature requests in the
[GitHub issues](https://github.com/upstash/sdk-qstash-ts/issues) or talk to us
on [Discord](https://discord.gg/w9SenAtbme). Thank you!

## How does QStash work?

QStash is the message broker between your serverless apps. You send aa HTTP
request to QStash, that includes a destination, a payload and optional settings.
We store your message durable and will deliver it to the destination API via
HTTP. In case the destination is not ready to receive the message, we will retry
the message later, to guarentee at-least-once delivery.

## Quick Start

### Install

#### npm

```bash
npm install @upstash/qstash
```

#### Deno

```ts
import { Client } from "https://deno.land/x/upstash_qstash/mod.ts";
```

### Get your authorization token

Go to [upstash](https://console.upstash.com/qstash) and copy the token.

## Basic Usage:

### Publishing a message

```ts
import { Client } from "@upstash/qstash";
/**
 * Import a fetch polyfill only if you are using node prior to v18.
 * This is not necessary for nextjs, deno or cloudflare workers.
 */
import "isomorphic-fetch";

const c = new Client({
  token: "<QSTASH_TOKEN>",
});

const res = await c.publishJSON({
  destination: "https://my-api...",
  body: {
    hello: "world",
  },
});
console.log(res);
// { messageId: "msg_xxxxxxxxxxxxxxxx" }
```

### Receiving a message

How to receive a message depends on your http server. The `Receiver.verify`
method should be called by you as the first step in your handler function.

```ts
import { Receiver } from "@upstash/qstash";

const r = new Receiver({
  currentSigningKey: "..",
  nextSigningKey: "..",
});

const isValid = await r.verify({
  /**
   * The signature from the `Upstash-Signature` header.
   */
  signature: "string";

  /**
   * The raw request body.
   */
  body: "string";
})
```

## Docs

See [the documentation](https://docs.upstash.com/qstash) for details.

## Contributing

### [Install Deno](https://deno.land/#installation)
