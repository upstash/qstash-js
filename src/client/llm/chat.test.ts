/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "../client";
import { OpenAIStream, StreamingTextResponse } from "ai";
import type { ChatCompletionChunk } from "./types";
import { openai, upstash } from "./providers";

async function checkStream(
  stream: AsyncIterable<ChatCompletionChunk>,
  expectInStream: string[] // array of strings to expect in stream
): Promise<void> {
  const _stream = OpenAIStream(stream);
  const textResponse = new StreamingTextResponse(_stream);
  const text = await textResponse.text();

  const lines = text.split("\n").filter((line) => line.length > 0);

  expect(lines.length).toBeGreaterThan(0);
  expect(lines.some((line) => line.startsWith('0:"'))).toBeTrue(); // all lines start with `0:"`
  expect(expectInStream.every((token) => text.includes(token))).toBeTrue();
}

describe("Test Qstash chat", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should respond to prompt",
    async () => {
      const response = await client.chat().prompt({
        provider: upstash(),
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        system: "from now on, foo is whale",
        user: "what exactly is foo?",
        temperature: 0.5,
      });

      expect(response instanceof ReadableStream).toBeFalse();
      expect(response.choices.length).toBe(1);
      expect(response.choices[0].message.content.includes("whale")).toBeTrue();
      expect(response.choices[0].message.role).toBe("assistant");
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should respond to create",
    async () => {
      const response = await client.chat().create({
        provider: upstash(),
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
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
        temperature: 0.5,
      });

      expect(response instanceof ReadableStream).toBeFalse();
      expect(response.choices.length).toBe(1);
      expect(response.choices[0].message.content.includes("whale")).toBeTrue();
      expect(response.choices[0].message.role).toBe("assistant");
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should stream prompt",
    async () => {
      const response = await client.chat().prompt({
        provider: upstash(),
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        system: "from now on, foo is whale",
        user: "what exactly is foo?",
        stream: true,
        temperature: 0.5,
      });

      await checkStream(response, ["whale"]);
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should stream create",
    async () => {
      const response = await client.chat().create({
        provider: upstash(),
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
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

      await checkStream(response, ["whale"]);
    },
    { timeout: 30_000, retry: 3 }
  );

  test("should publish with llm api", async () => {
    const result = await client.publishJSON({
      api: { name: "llm", provider: upstash() },
      body: {
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [
          {
            role: "user",
            content: "hello",
          },
        ],
      },
      callback: "https://example.com",
    });
    expect(result.messageId).toBeTruthy();
  });

  test("should batch with llm api", async () => {
    const result = await client.batchJSON([
      {
        api: { name: "llm", provider: upstash() },
        body: {
          model: "meta-llama/Meta-Llama-3-8B-Instruct",
          messages: [
            {
              role: "user",
              content: "hello",
            },
          ],
        },
        callback: "https://example.com",
      },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].messageId).toBeTruthy();
  });

  test("should enqueue with llm api", async () => {
    const queueName = "upstash-queue";
    const queue = client.queue({ queueName });
    const result = await queue.enqueueJSON({
      api: { name: "llm", provider: upstash() },
      body: {
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [
          {
            role: "user",
            content: "hello",
          },
        ],
      },
      callback: "https://example.com/",
    });
    expect(result.messageId).toBeTruthy();
  });
});

describe("Test Qstash chat with third party LLMs", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test(
    "should respond to prompt",
    async () => {
      const response = await client.chat().prompt({
        provider: openai({ token: process.env.OPENAI_API_KEY! }),
        model: "gpt-3.5-turbo",
        system: "from now on, foo is whale",
        user: "what exactly is foo?",
        temperature: 0.5,
      });

      expect(response instanceof ReadableStream).toBeFalse();
      expect(response.choices.length).toBe(1);
      expect(response.choices[0].message.content.includes("whale")).toBeTrue();
      expect(response.choices[0].message.role).toBe("assistant");
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should respond to create",
    async () => {
      const response = await client.chat().create({
        provider: openai({ token: process.env.OPENAI_API_KEY! }),
        model: "gpt-3.5-turbo",
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
        temperature: 0.5,
      });

      expect(response instanceof ReadableStream).toBeFalse();
      expect(response.choices.length).toBe(1);
      expect(response.choices[0].message.content.includes("whale")).toBeTrue();
      expect(response.choices[0].message.role).toBe("assistant");
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should stream prompt",
    async () => {
      const response = await client.chat().prompt({
        provider: openai({ token: process.env.OPENAI_API_KEY! }),
        model: "gpt-3.5-turbo",
        system: "from now on, foo is whale",
        user: "what exactly is foo?",
        stream: true,
        temperature: 0.5,
      });

      await checkStream(response, ["whale"]);
    },
    { timeout: 30_000, retry: 3 }
  );

  test(
    "should stream create",
    async () => {
      const response = await client.chat().create({
        provider: openai({ token: process.env.OPENAI_API_KEY! }),
        model: "gpt-3.5-turbo",
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

      await checkStream(response, ["whale"]);
    },
    { timeout: 30_000, retry: 3 }
  );

  test("should publish with llm api", async () => {
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
    expect(result.messageId).toBeTruthy();
  });

  test("should batch with llm api", async () => {
    const result = await client.batchJSON([
      {
        api: { name: "llm", provider: openai({ token: process.env.OPENAI_API_KEY! }) },
        body: {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: "hello",
            },
          ],
        },
        callback: "https://example.com",
      },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].messageId).toBeTruthy();
  });

  test("should enqueue with llm api", async () => {
    const queueName = "upstash-queue";
    const queue = client.queue({ queueName });
    const result = await queue.enqueueJSON({
      api: { name: "llm", provider: openai({ token: process.env.OPENAI_API_KEY! }) },
      body: {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: "hello",
          },
        ],
      },
      callback: "https://example.com/",
    });
    expect(result.messageId).toBeTruthy();
  });
});
