# Upstash QStash SDK

![npm (scoped)](https://img.shields.io/npm/v/@upstash/qstash)

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

## How does QStash work?

QStash is the message broker between your serverless apps. You send an HTTP
request to QStash, that includes a destination, a payload and optional settings.
We durably store your message and will deliver it to the destination API via
HTTP. In case the destination is not ready to receive the message, we will retry
the message later, to guarentee at-least-once delivery.

## Quick Start

### Install

#### npm

```bash
npm install @upstash/qstash
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
  url: "https://my-api...",
  // or topic: "the name or id of a topic"
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
   *
   * Please note that on some platforms (e.g. Vercel or Netlify) you might
   * receive the header in lower case: `upstash-signature` 
   *
   */
  signature: "string";

  /**
   * The raw request body.
   */
  body: "string";

  /**
   * Number of seconds to tolerate when checking `nbf` and `exp` claims, to deal with small clock differences among different servers
   *
   * @default 0
   */
  clockTolerance?: number;
})
```

## Docs

See [the documentation](https://docs.upstash.com/qstash) for details.

## Contributing

### [Install Deno](https://deno.land/#installation)
