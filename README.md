# Upstash QStash SDK

![npm (scoped)](https://img.shields.io/npm/v/@upstash/qstash)

> [!NOTE] > **This project is in GA Stage.**
> The Upstash Professional Support fully covers this project. It receives regular updates, and bug fixes.
> The Upstash team is committed to maintaining and improving its functionality.

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

Go to [Upstash Console](https://console.upstash.com/qstash) and copy the QSTASH_TOKEN.

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
  // or urlGroup: "the name or id of a url group"
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
})
```

### Publishing a message to Open AI or any Open AI Compatible LLM

No need for complicated setup your LLM request. We'll call LLM and schedule it for your serverless needs.

```ts
import { Client, openai } from "@upstash/qstash";

const c = new Client({
  token: "<QSTASH_TOKEN>",
});

const result = await client.publishJSON({
  api: { name: "llm", provider: openai({ token: process.env.OPENAI_API_KEY! }) },
  body: {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: "Where is the capital of Turkey?",
      },
    ],
  },
  callback: "https://oz.requestcatcher.com/",
});
```

### Chatting with your favorite LLM

You can easily start streaming Upstash or OpenAI responses from your favorite framework(Next.js) or library

```ts
import { Client, upstash } from "@upstash/qstash";

const c = new Client({
  token: "<QSTASH_TOKEN>",
});

const response = await client.chat().create({
  provider: upstash(), // Optionally, provider: "custom({token: "XXX", baseUrl: "https://api.openai.com"})". This will allow you to call every OpenAI compatible API out there.
  model: "meta-llama/Meta-Llama-3-8B-Instruct", // Optionally, model: "gpt-3.5-turbo",
  messages: [
    {
      role: "system",
      content: "from now on, foo is whale",
    },
    {
      role: "user",
      content: "what exactly is foo?",
    },
  ],
  stream: true,
  temperature: 0.5,
});
```

### Add Observability via Helicone

Helicone is a powerful observability platform that provides valuable insights into your LLM usage. Integrating Helicone with QStash is straightforward.

To enable Helicone observability in QStash, you simply need to pass your Helicone API key when initializing your model. Here's how to do it for both custom models and OpenAI:

#### For Custom Models (e.g., Meta-Llama)

```ts
import { Client, custom } from "@upstash/qstash";

const c = new Client({
  token: "<QSTASH_TOKEN>",
});

await client.publishJSON({
  api: {
    name: "llm",
    provider: custom({
      token: "XXX",
      baseUrl: "https://api.together.xyz",
    }),
    analytics: { name: "helicone", token: process.env.HELICONE_API_KEY! },
  },
  body: {
    model: "meta-llama/Llama-3-8b-chat-hf",
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  },
  callback: "https://oz.requestcatcher.com/",
});
```

```

### Adding

## Docs

See [the documentation](https://docs.upstash.com/qstash) for details.

## Contributing

### [Install Deno](https://deno.land/#installation)
```
