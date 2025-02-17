/* eslint-disable @typescript-eslint/no-deprecated */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { OpenAIStream, StreamingTextResponse } from "ai";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Client } from "../client";
import type { ChatCompletionChunk } from "./types";
import type { Requester } from "../http";
import { openai } from "../api/llm";

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

const parseMockCall = (mockResponse: unknown) => {
  const fields = mockResponse as { body: string };

  return {
    ...fields,
    body: JSON.parse(fields.body),
  } as unknown;
};

describe("Test QStash chat", () => {
  const client = new Client({ token: "test-token" });
  const mockHttp = {
    request: mock((config: unknown) => {
      return config as Promise<unknown>;
    }),
    requestStream: mock((config: unknown) => {
      return config as AsyncIterable<ChatCompletionChunk>;
    }),
  };

  const mockOpenai = openai({
    token: "test-openai-token",
  });

  client.http = mockHttp as Requester;

  beforeEach(() => {
    mockHttp.request.mockClear();
    mockHttp.requestStream.mockClear();
  });

  test("should respond to prompt", async () => {
    mockHttp.request.mockResolvedValue({
      choices: [
        {
          message: {
            content: "It's whale",
            role: "assistant",
          },
        },
      ],
    });

    const response = await client.chat().prompt({
      provider: mockOpenai,
      model: "gpt-3.5-turbo",
      system: "from now on, foo is whale",
      user: "what exactly is foo?",
      temperature: 0.5,
    });

    expect(parseMockCall(mockHttp.request.mock.calls[0][0])).toEqual({
      baseUrl: "https://api.openai.com",
      path: ["v1", "chat", "completions"],
      body: {
        model: "gpt-3.5-turbo",
        temperature: 0.5,
        messages: [
          { role: "system", content: "from now on, foo is whale" },
          { role: "user", content: "what exactly is foo?" },
        ],
      },
      headers: {
        Authorization: "Bearer test-openai-token",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    expect(response instanceof ReadableStream).toBeFalse();
    expect(response.choices.length).toBe(1);
    expect(response.choices[0].message.content.includes("whale")).toBeTrue();
    expect(response.choices[0].message.role).toBe("assistant");
  });

  test("should respond to create", async () => {
    mockHttp.request.mockResolvedValue({
      choices: [
        {
          message: {
            content: "It's whale",
            role: "assistant",
          },
        },
      ],
    });

    const response = await client.chat().create({
      provider: mockOpenai,
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

    expect(parseMockCall(mockHttp.request.mock.calls[0][0])).toEqual({
      baseUrl: "https://api.openai.com",
      path: ["v1", "chat", "completions"],
      body: {
        model: "gpt-3.5-turbo",
        temperature: 0.5,
        messages: [
          { role: "system", content: "from now on, foo is whale" },
          { role: "user", content: "what exactly is foo?" },
        ],
      },
      headers: {
        Authorization: "Bearer test-openai-token",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    expect(response instanceof ReadableStream).toBeFalse();
    expect(response.choices.length).toBe(1);
    expect(response.choices[0].message.content.includes("whale")).toBeTrue();
    expect(response.choices[0].message.role).toBe("assistant");
  });

  test("should stream prompt", async () => {
    const mockResponseStream = {
      [Symbol.asyncIterator]: async function* () {
        await new Promise((r) => setTimeout(r, 100));

        yield {
          choices: [
            {
              delta: {
                content: "It's whale",
              },
            },
          ],
        };
      },
    };

    // @ts-expect-error Mocked stream
    mockHttp.requestStream.mockResolvedValue(mockResponseStream);

    const response = await client.chat().prompt({
      provider: mockOpenai,
      model: "gpt-3.5-turbo",
      system: "from now on, foo is whale",
      user: "what exactly is foo?",
      stream: true,
      temperature: 0.5,
    });

    expect(parseMockCall(mockHttp.requestStream.mock.calls[0][0])).toEqual({
      baseUrl: "https://api.openai.com",
      path: ["v1", "chat", "completions"],
      body: {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "from now on, foo is whale" },
          { role: "user", content: "what exactly is foo?" },
        ],
        stream: true,
        temperature: 0.5,
      },
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        Authorization: "Bearer test-openai-token",
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    await checkStream(response, ["whale"]);
  });

  test(
    "should stream create",
    async () => {
      const mockResponseStream = {
        [Symbol.asyncIterator]: async function* () {
          await new Promise((r) => setTimeout(r, 100));

          yield {
            choices: [
              {
                delta: {
                  content: "It's whale",
                },
              },
            ],
          };
        },
      };

      // @ts-expect-error Mocked stream
      mockHttp.requestStream.mockResolvedValue(mockResponseStream);

      const response = await client.chat().create({
        provider: mockOpenai,
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

      expect(parseMockCall(mockHttp.requestStream.mock.calls[0][0])).toEqual({
        baseUrl: "https://api.openai.com",
        path: ["v1", "chat", "completions"],
        body: {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "from now on, foo is whale" },
            { role: "user", content: "what exactly is foo?" },
          ],
          stream: true,
          temperature: 0.5,
        },
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          Authorization: "Bearer test-openai-token",
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      await checkStream(response, ["whale"]);
    },
    { timeout: 30_000, retry: 3 }
  );

  test("should not be able to without callback", () => {
    //@ts-expect-error We intentionally omit the callback to ensure the function fails as expected
    const resultPromise = client.publishJSON({
      api: {
        name: "llm",
        provider: mockOpenai,
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
    mockHttp.request.mockResolvedValue([
      {
        messageId: "message-id-1",
      },
    ]);

    const result = await client.batchJSON([
      {
        api: {
          name: "llm",
          provider: mockOpenai,
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

    expect(mockHttp.request.mock.calls.length).toBe(1);
    expect(parseMockCall(mockHttp.request.mock.calls[0][0])).toEqual({
      method: "POST",
      path: ["v2", "batch"],
      body: [
        {
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "hello" }],
          }),
          destination: "https://api.openai.com/v1/chat/completions",
          headers: {
            "content-type": "application/json",
            "upstash-callback": "https://example.com",
            "upstash-forward-authorization": "Bearer test-openai-token",
            "upstash-method": "POST",
          },
        },
      ],
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(result.length).toBe(1);
    expect(result[0].messageId).toBeTruthy();
  });

  test("should enqueue with llm api", async () => {
    const queueName = "upstash-queue";
    const queue = client.queue({ queueName });
    await queue.enqueueJSON({
      api: {
        name: "llm",
        provider: mockOpenai,
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

    expect(parseMockCall(mockHttp.request.mock.calls[0][0])).toEqual({
      path: ["v2", "enqueue", "upstash-queue", "https://api.openai.com/v1/chat/completions"],
      method: "POST",
      body: {
        messages: [
          {
            content: "hello",
            role: "user",
          },
        ],
        model: "gpt-3.5-turbo",
      },
      headers: new Headers({
        "content-type": "application/json",
        "upstash-callback": "https://example.com/",
        "upstash-forward-authorization": "Bearer test-openai-token",
        "upstash-method": "POST",
      }),
    });
  });

  test("should call request with analytics enabled", async () => {
    await client.chat().create({
      provider: mockOpenai,
      model: "gpt-3.5-turbo",
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
    });

    expect(parseMockCall(mockHttp.request.mock.calls[0][0])).toEqual({
      baseUrl: "https://gateway.helicone.ai/v1/chat/completions",
      path: [],
      method: "POST",
      body: {
        messages: [
          {
            content: "from now on, foo is whale",
            role: "system",
          },
          {
            content: "what exactly is foo?",
            role: "user",
          },
        ],
        model: "gpt-3.5-turbo",
        stream: false,
        temperature: 0.5,
      },
      headers: {
        Authorization: "Bearer test-openai-token",
        "Content-Type": "application/json",
        "Helicone-Auth": "Bearer helicone-token",
        "Helicone-Target-Url": "https://api.openai.com",
      },
    });
  });
});
