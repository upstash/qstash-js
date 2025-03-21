/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { OpenAIStream, StreamingTextResponse } from "ai";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Client } from "../client";
import type { ChatCompletionChunk, ChatRequest } from "./types";
import type { Requester } from "../http";
import { upstash, openai, custom } from "../api/llm";

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

describe("Test QStash chat", () => {
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

  test.skip("should publish with llm api", async () => {
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

    // sleep before checking the message
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await new Promise((r) => setTimeout(r, 3000));

    const { logs } = await client.logs({ filter: { messageId: result.messageId } });
    const deliveredEvent = logs.find((event) => event.state === "DELIVERED");
    expect(deliveredEvent).not.toBeUndefined();
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

describe("Test QStash chat with third party LLMs", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return new Promise((r) => setTimeout(r, 1000));
  });

  test(
    "should respond to prompt",
    async () => {
      const response = await client.chat().prompt({
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
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
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
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
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
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
        provider: openai({
          token: process.env.OPENAI_API_KEY!,
          organization: process.env.OPENAI_ORGANIZATION!,
        }),
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
});

describe("createThirdParty", () => {
  // Use a dummy token for testing
  const client = new Client({ token: "test-token" });
  const mockHttp = {
    request: mock((config: unknown) => {
      return config as Promise<unknown>;
    }),
    requestStream: mock((config: unknown) => {
      return config as AsyncIterable<ChatCompletionChunk>;
    }),
    wrapWithGlobalHeaders: (headers: Headers) => headers,
  };

  client.http = mockHttp as Requester;

  test("should delete provider, system and analytics to prevent adding them to body", async () => {
    const mockRequest = {
      provider: {
        baseUrl: "https://api.together.xyz",
        token: "xxx",
        owner: "together",
      },
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      temperature: 0.5,
      stream: false,
      analytics: {
        name: "helicone",
        token: "helicone-token",
      },
      system: "Some system message", // This should be deleted
    };

    //@ts-expect-error required for tests because createThirdParty is private
    await client.chat().createThirdParty(mockRequest);

    const requestBody = JSON.parse((mockHttp.request.mock.calls[0][0] as any).body);

    // Explicitly check that deleted properties are not in the body
    expect(requestBody).not.toHaveProperty("provider");
    expect(requestBody).not.toHaveProperty("system");
    expect(requestBody).not.toHaveProperty("analytics");

    // Check that other properties are still present with correct values
    expect(requestBody).toEqual({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      temperature: 0.5,
      stream: false,
    });
  });

  test("should call request with analytics enabled", async () => {
    const testOrganization = "my-org";
    const mockRequest = {
      provider: {
        baseUrl: "https://api.together.xyz",
        token: "xxx",
        owner: "together",
        organization: testOrganization,
      },
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      temperature: 0.5,
      stream: false,
      analytics: {
        name: "helicone",
        token: "helicone-token",
      },
      system: "Some system message", // This will be deleted
    };

    //@ts-expect-error required for tests because createThirdParty is private
    await client.chat().createThirdParty(mockRequest);

    expect(mockHttp.request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: [],
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer xxx",
          "Helicone-Auth": "Bearer helicone-token",
          "Helicone-Target-Url": "https://api.together.xyz",
          "OpenAI-Organization": testOrganization,
        }),
        baseUrl: "https://gateway.helicone.ai/v1/chat/completions",
      })
    );

    expect(JSON.parse((mockHttp.request.mock.calls[0][0] as any).body)).toEqual({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      temperature: 0.5,
      stream: false,
    });
  });

  test("should call requestStream with analytics disabled and stream enabled", async () => {
    const mockRequest: ChatRequest<{ stream: true }> = {
      provider: custom({ baseUrl: "https://api.together.xyz", token: "xxx" }),
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      stream: true,
      temperature: 0.5,
    };

    //@ts-expect-error required for tests because createThirdParty is private
    await client.chat().createThirdParty(mockRequest);

    expect(mockHttp.requestStream).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["v1", "chat", "completions"],
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer xxx",
          Connection: "keep-alive",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        }),
        baseUrl: "https://api.together.xyz",
      })
    );

    expect(JSON.parse((mockHttp.requestStream.mock.calls[0][0] as any).body)).toEqual({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        { role: "system", content: "from now on, foo is whale" },
        { role: "user", content: "what exactly is foo?" },
      ],
      temperature: 0.5,
      stream: true,
    });
  });
});
