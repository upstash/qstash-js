# Upstash qStash SDK

[![Tests](https://github.com/upstash/upstash-redis/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/upstash-redis/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/redis)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/@upstash/redis)

**qStash** is a serverless queueing / messaging system, designed to be used with
serverless functions to consume from the queue.

It is the only connectionless (HTTP based) Redis client and designed for:

- Serverless functions (AWS Lambda ...)
- Cloudflare Workers (see
  [the example](https://github.com/upstash/upstash-redis/tree/main/examples/cloudflare-workers))
- Fastly Compute@Edge (see
  [the example](https://github.com/upstash/upstash-redis/tree/main/examples/fastly))
- Next.js, Jamstack ...
- Client side web/mobile applications
- WebAssembly
- and other environments where HTTP is preferred over TCP.

See
[the list of APIs](https://docs.upstash.com/features/restapi#rest---redis-api-compatibility)
supported.

## How does qStash work?

qStash is the message broker between your serverless apps. You send a HTTP
request to qStash, that includes a destination, a payload and optional settings.
We store your message durable and will deliver it to the destination server via
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
import { Redis } from "https://deno.land/x/upstash_qstash/mod.ts";
```

### Activate qStash

Go to [upstash](https://console.upstash.com/qstash) and activate qStash.

## Basic Usage:

### Publishing a message

```ts
import { Client } from "@upstash/qstash"

const q = new Client({
  token: <QSTASH_TOKEN>,
})

const res = await q.publishJSON({
    body: { hello: "world" },
})

console.log(res.messageID)
```

### Consuming a message

How to consume a message depends on your http server. QStash does not receive
the http request directly, but should be called by you as the first step in your
handler function.

```ts
import { Consumer } from "@upstash/qstash";

const c = new Consumer({
  currentSigningKey: "..",
  nextSigningKey: "..",
});

const isValid = await c.verify({
  /**
   * The signature from the `upstash-signature` header.
   */
  signature: "string";

  /**
   * The raw request body.
   */
  body: "string";

  /**
   * URL of the endpoint where the request was sent to.
   */
  url: "string";
})
```

## Docs

See [the documentation](https://docs.upstash.com/features/qstash) for details.

## Contributing

### [Install Deno](https://deno.land/#installation)

### Running tests

```sh
QSTASH_TOKEN=".." deno test -A
```

```
```
