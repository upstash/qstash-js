/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "bun:test";
import { Client } from "../client";
import { openai } from "../api/llm";

describe("Test QStash chat with third party LLMs", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return new Promise((r) => setTimeout(r, 1000));
  });

  test("should not be able to without callback", () => {
    //@ts-expect-error We intentionally omit the callback to ensure the function fails as expected
    const resultPromise = client.publishJSON({
      api: {
        name: "llm",
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
      },
      body: {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: "Where is the capital of Turkey?",
          },
        ],
      },
    });

    expect(resultPromise).rejects.toThrow("Callback cannot be undefined when using LLM");
  });

  test("should batch with llm api", async () => {
    const result = await client.batchJSON([
      {
        api: {
          name: "llm",
          provider: openai({
            token: process.env.OPENAI_API_KEY!,
            organization: process.env.OPENAI_ORGANIZATION!,
          }),
        },
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
      api: {
        name: "llm",
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
      },
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
