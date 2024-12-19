/* eslint-disable unicorn/no-null */
import { describe, test } from "bun:test";
import { Client } from "../client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";
import { anthropic, upstash, openai, custom } from "./llm";

describe("llm", () => {
  const customBaseUrl = `https://custom-llm-${nanoid()}.com`;
  const callback = `https://website-${nanoid()}.com`;
  const llmToken = `token-llm-${nanoid()}`;
  const qstashToken = `token-qstash-${nanoid()}`;
  const analyticsToken = `token-analytics-${nanoid()}`;
  const model = `model-${nanoid()}`;

  const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token: qstashToken });

  test("should use upstash as default", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/api/llm",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": null,
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call analytics with upstash", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            provider: upstash(),
            analytics: { name: "helicone", token: analyticsToken },
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://qstash.helicone.ai/llm/v1/chat/completions",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${qstashToken}`,
          "upstash-forward-helicone-auth": `Bearer ${analyticsToken}`,
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call openai", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: openai({ token: llmToken, organization: "my-org" }),
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://api.openai.com/v1/chat/completions",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${llmToken}`,
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call openai with analytics", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: openai({ token: llmToken, organization: "my-org" }),
            analytics: { name: "helicone", token: analyticsToken },
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://gateway.helicone.ai/v1/chat/completions",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${llmToken}`,
          "upstash-forward-helicone-auth": `Bearer ${analyticsToken}`,
          "upstash-forward-helicone-target-url": "https://api.openai.com",
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call anthropic", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: anthropic({ token: llmToken }),
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://api.anthropic.com/v1/messages",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-x-api-key": llmToken,
          "upstash-forward-anthropic-version": "2023-06-01",
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call anthropic with analytics", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: anthropic({ token: llmToken }),
            analytics: { name: "helicone", token: analyticsToken },
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://gateway.helicone.ai/v1/messages",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-x-api-key": llmToken,
          "upstash-forward-helicone-auth": `Bearer ${analyticsToken}`,
          "upstash-forward-helicone-target-url": "https://api.anthropic.com",
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call custom", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: custom({ baseUrl: customBaseUrl, token: llmToken }),
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: `http://localhost:8080/v2/publish/${customBaseUrl}/v1/chat/completions`,
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${llmToken}`,
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });

  test("should call custom with analytics", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "llm",
            provider: custom({ baseUrl: customBaseUrl, token: llmToken }),
            analytics: { name: "helicone", token: analyticsToken },
          },
          body: {
            model,
          },
          callback,
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://gateway.helicone.ai/v1/chat/completions",
        body: { model },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${llmToken}`,
          "upstash-forward-helicone-auth": `Bearer ${analyticsToken}`,
          "upstash-forward-helicone-target-url": customBaseUrl,
          "upstash-callback": callback,
          "upstash-method": "POST",
          "content-type": "application/json",
        },
      },
    });
  });
});
