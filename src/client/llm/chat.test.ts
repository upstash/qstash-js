/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "bun:test";
import { Client } from "../client";
import { openai } from "../api/llm";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";

describe("Test QStash chat with third party LLMs", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return new Promise((r) => setTimeout(r, 1000));
  });

  test.skip("should publish with llm api", async () => {
    const result = await client.publishJSON({
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
      callback: "https://oz.requestcatcher.com/",
    });
    expect(result.messageId).toBeTruthy();

    // sleep before checking the message
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await new Promise((r) => setTimeout(r, 3000));

    const { logs } = await client.logs({ filter: { messageId: result.messageId } });
    const deliveredEvent = logs.find((event) => event.state === "DELIVERED");
    expect(deliveredEvent).not.toBeUndefined();
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

  test("should call openai with analytics", async () => {
    const token = nanoid();
    const heliconeToken = nanoid();
    const openaiToken = nanoid();
    const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });

    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: openai({
              token: openaiToken,
            }),
            analytics: { name: "helicone", token: heliconeToken },
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
          callback: "https://oz.requestcatcher.com/",
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://gateway.helicone.ai/v1/chat/completions`,
        token,
        body: {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: "Where is the capital of Turkey?",
            },
          ],
        },
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "upstash-callback": "https://oz.requestcatcher.com/",
          "upstash-forward-authorization": `Bearer ${openaiToken}`,
          "upstash-forward-helicone-auth": `Bearer ${heliconeToken}`,
          "upstash-forward-helicone-target-url": "https://api.openai.com",
          "upstash-method": "POST",
        },
      },
    });
  });
});
