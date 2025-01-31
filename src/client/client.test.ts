/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";
import { Client } from "./client";
import type { PublishToUrlResponse } from "../../dist";

export const clearQueues = async (client: Client) => {
  const queueDetails = await client.queue().list();
  await Promise.all(
    queueDetails.map(async (q) => {
      await client.queue({ queueName: q.name }).delete();
    })
  );
};

describe("E2E Publish", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    await clearQueues(client);
  });

  beforeAll(async () => {
    await clearQueues(client);
  });

  test("should publish a json message", async () => {
    const result = await client.publishJSON({
      url: "https://example.com/",
      body: { hello: "world" },
      headers: {
        "test-header": "test-value",
        "Upstash-Forward-bypass-tunnel-reminder": "client-test",
      },
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    const messageHeaders = new Headers(verifiedMessage.header);

    expect(messageHeaders.get("test-header")).toEqual("test-value");
    expect(messageHeaders.get("bypass-tunnel-reminder")).toEqual("client-test");
    expect(verifiedMessage.body).toEqual(JSON.stringify({ hello: "world" }));
  });

  test("should verify qstash server removed forwaded header prefix", async () => {
    const result = await client.publishJSON({
      url: "https://example.com/",
      headers: {
        "Upstash-Forward-bypass-tunnel-reminder": "client-test",
      },
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    const messageHeaders = new Headers(verifiedMessage.header);

    expect(messageHeaders.get("Upstash-Forward-bypass-tunnel-reminder")).toBeNull();
  });

  test("should publish a message with a delay", async () => {
    const result = await client.publish({
      url: "https://example.com/",
      delay: 5,
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    expect(verifiedMessage.notBefore).toBeGreaterThanOrEqual(Date.now());
  });

  test("should publish a message with a notBefore", async () => {
    const delay = (Date.now() + 1000 * 5) / 1000;
    const result = await client.publish({
      url: "https://example.com/",
      notBefore: delay,
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    expect(verifiedMessage.notBefore).toBeGreaterThanOrEqual(delay);
  });

  test("should publish a message with a callback", async () => {
    const result = await client.publish({
      url: "https://example.com/",
      callback: `https://oz.requestcatcher.com/?foo=bar`,
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    expect(verifiedMessage.callback).toBe("https://oz.requestcatcher.com/?foo=bar");
  });

  test("should publish a message and fail then call failure callback", async () => {
    const retryCount = 1;

    const result = await client.publish({
      url: "https://example.com/",
      retries: retryCount, // Retries after 12 sec
      failureCallback: `https://oz.requestcatcher.com/?foo=bar`,
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    expect(verifiedMessage.maxRetries).toBeGreaterThanOrEqual(retryCount);
    expect(verifiedMessage.failureCallback).toBe("https://oz.requestcatcher.com/?foo=bar");
  });

  test("should use global headers", async () => {
    const clientWithHeaders = new Client({
      token: process.env.QSTASH_TOKEN!,
      // @ts-expect-error undefined header
      headers: {
        "undefined-header": undefined,
        "test-header": "value",
        "test-header-2": "value-2",
        "TEST-CASE": "value-uppercase",
        "test-case": "value-lowercase",
      },
    });
    const result = await clientWithHeaders.publish({
      url: "https://example.com/",
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    const messageHeaders = new Headers(verifiedMessage.header);

    expect(messageHeaders.get("test-header")).toEqual("value");
    expect(messageHeaders.get("test-header-2")).toEqual("value-2");
    expect(messageHeaders.get("test-case")).toEqual("value-uppercase, value-lowercase");
    expect(messageHeaders.get("undefined-header")).toEqual("undefined");
  });

  test("should override global headers", async () => {
    const clientWithHeaders = new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: {
        "test-header": "value",
        "test-header-2": "value-2",
        "stays-same": "same",
      },
    });
    const result = await clientWithHeaders.publish({
      url: "https://example.com/",
      headers: {
        "Test-Header": "override-value",
      },
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    const messageHeaders = new Headers(verifiedMessage.header);

    expect(messageHeaders.get("test-header")).toEqual("override-value");
    expect(messageHeaders.get("test-header-2")).toEqual("value-2");
    expect(messageHeaders.get("stays-same")).toEqual("same");
  });

  test("should override global headers with publishJSON if headers are provided", async () => {
    const clientWithHeaders = new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: {
        "test-header": "value",
        "test-header-2": "value-2",
      },
    });
    const result = await clientWithHeaders.publishJSON({
      url: "https://example.com/",
      headers: {
        "Test-Header": "override-value",
        "stays-same": "same",
      },
    });

    const verifiedMessage = await client.messages.get(result.messageId);
    const messageHeaders = new Headers(verifiedMessage.header);

    expect(messageHeaders.get("test-header")).toEqual("override-value");
    expect(messageHeaders.get("test-header-2")).toEqual("value-2");
    expect(messageHeaders.get("stays-same")).toEqual("same");
  });
});

describe("E2E Batch", () => {
  test("should override global headers", async () => {
    const client = new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: {
        "test-header": "value",
        "test-header-2": "value-2",
      },
    });
    const result = (await client.batch([
      {
        url: "https://example.com/1",
        headers: {
          "Test-Header": "override-value-1",
          "stays-same": "same",
        },
      },
      {
        url: "https://example.com/2",
        headers: {
          "Test-Header": "override-value-2",
          "stays-same": "same",
        },
      },
    ])) as PublishToUrlResponse[];

    const verifiedMessage1 = await client.messages.get(result[0].messageId);
    const messageHeaders1 = new Headers(verifiedMessage1.header);

    const verifiedMessage2 = await client.messages.get(result[1].messageId);
    const messageHeaders2 = new Headers(verifiedMessage2.header);

    expect(messageHeaders1.get("test-header")).toEqual("override-value-1");
    expect(messageHeaders2.get("test-header")).toEqual("override-value-2");

    expect(messageHeaders1.get("stays-same")).toEqual("same");
    expect(messageHeaders2.get("stays-same")).toEqual("same");

    expect(messageHeaders1.get("test-header-2")).toEqual("value-2");
    expect(messageHeaders2.get("test-header-2")).toEqual("value-2");
  });

  test("should override global headers with batchJSON", async () => {
    const client = new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: {
        "test-header": "value",
        "test-header-2": "value-2",
      },
    });
    const result = (await client.batchJSON([
      {
        url: "https://example.com/1",
        headers: {
          "Test-Header": "override-value-1",
          "stays-same": "same",
        },
      },
      {
        url: "https://example.com/2",
        headers: {
          "Test-Header": "override-value-2",
          "stays-same": "same",
        },
      },
    ])) as PublishToUrlResponse[];

    const verifiedMessage1 = await client.messages.get(result[0].messageId);
    const messageHeaders1 = new Headers(verifiedMessage1.header);

    const verifiedMessage2 = await client.messages.get(result[1].messageId);
    const messageHeaders2 = new Headers(verifiedMessage2.header);

    expect(messageHeaders1.get("test-header")).toEqual("override-value-1");
    expect(messageHeaders2.get("test-header")).toEqual("override-value-2");

    expect(messageHeaders1.get("stays-same")).toEqual("same");
    expect(messageHeaders2.get("stays-same")).toEqual("same");

    expect(messageHeaders1.get("test-header-2")).toEqual("value-2");
    expect(messageHeaders2.get("test-header-2")).toEqual("value-2");
  });
});

describe("E2E Url Group Publish", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should publish message multiple url groups", async () => {
    const endpoint = { name: "urlGroup1", url: "https://oz.requestcatcher.com/?foo=bar" };
    const endpoint1 = { name: "urlGroup2", url: "https://oz.requestcatcher.com/?baz=bar" };
    const urlGroup = "my-proxy-url-group";

    await client.urlGroups.addEndpoints({
      endpoints: [endpoint, endpoint1],
      name: urlGroup,
    });

    const result = await client.publish({
      headers: {
        "test-header": "test-value",
        "Upstash-Forward-bypass-tunnel-reminder": "client-test",
      },
      urlGroup,
      delay: 3,
    });
    const verifiedMessage = await client.messages.get(result[0].messageId);
    const verifiedMessage1 = await client.messages.get(result[1].messageId);

    for (const messageDetail of [verifiedMessage, verifiedMessage1]) {
      expect(messageDetail.urlGroup).toEqual(urlGroup);
    }
    await client.urlGroups.delete(urlGroup);
  });
});

describe("E2E Queue", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  afterAll(async () => {
    const queueDetails = await client.queue().list();
    const urlGroups = await client.urlGroups.list();

    await Promise.all(
      urlGroups.map(async (t) => {
        await client.urlGroups.delete(t.name);
      })
    );

    await Promise.all(
      queueDetails.map(async (q) => {
        await client.queue({ queueName: q.name }).delete();
      })
    );
  });

  test(
    "should create a queue, verify it then remove it",
    async () => {
      const queueName = nanoid();
      await client.queue({ queueName }).upsert({ parallelism: 1 });

      const queueDetails = await client.queue({ queueName }).enqueue({
        url: "https://oz.requestcatcher.com/?foo=bar",
        body: JSON.stringify({ hello: "world" }),
        headers: {
          "test-header": "test-value",
          "Upstash-Forward-bypass-tunnel-reminder": "client-test",
        },
      });

      const verifiedMessage = await client.messages.get(queueDetails.messageId);
      expect(verifiedMessage.queueName).toBe(queueName);
      await client.queue({ queueName }).delete();
    },
    { timeout: 35_000 }
  );

  test(
    "should batch items to urlGroup and url with queueName",
    async () => {
      const queueName = nanoid();
      const urlGroup = nanoid();

      await client.queue({ queueName }).upsert({ parallelism: 1 });
      await client.urlGroups.addEndpoints({
        name: urlGroup,
        endpoints: [{ url: "https://example.com/", name: "first" }],
      });

      const result = await client.batch([
        {
          urlGroup: urlGroup,
          body: "message",
          queueName,
        },
        {
          url: "https://example.com/",
          queueName,
        },
      ]);
      expect(Array.isArray(result)).toBeTrue();
      await client.queue({ queueName }).delete();
    },
    { timeout: 35_000 }
  );

  test(
    "should return batch result as array when there is a single item",
    async () => {
      const queueName = nanoid();
      const urlGroup = nanoid();

      await client.queue({ queueName }).upsert({ parallelism: 1 });
      await client.urlGroups.addEndpoints({
        name: urlGroup,
        endpoints: [{ url: "https://example.com/", name: "first" }],
      });

      const result = await client.batch([
        {
          urlGroup: urlGroup,
          body: "message",
          queueName,
        },
      ]);
      expect(Array.isArray(result)).toBeTrue();
      await client.queue({ queueName }).delete();
    },
    { timeout: 35_000 }
  );

  test(
    "should batch json items to urlGroup and url with queueName",
    async () => {
      const queueName = nanoid();
      const urlGroup = nanoid();

      await client.queue({ queueName }).upsert({ parallelism: 1 });
      await client.urlGroups.addEndpoints({
        name: urlGroup,
        endpoints: [{ url: "https://example.com/", name: "first" }],
      });

      await client.batchJSON([
        {
          urlGroup: urlGroup,
          body: "message",
          queueName,
        },
        {
          url: "https://example.com/",
          queueName,
        },
      ]);
      await client.queue({ queueName }).delete();
    },
    { timeout: 35_000 }
  );
});

const checkClient = (client: Client, expectedBaseUrl: string, expectedToken: string) => {
  // @ts-expect-error accessing private field
  expect(client.http.baseUrl).toBe(expectedBaseUrl);
  // @ts-expect-error accessing private field
  expect(client.token).toBe(expectedToken);
};

describe("initialization", () => {
  const baseUrl = "https://some-url.com";
  const token = "some-token";

  const qstashUrl = process.env.QSTASH_URL;
  const qstashToken = process.env.QSTASH_TOKEN;

  afterAll(() => {
    process.env.QSTASH_URL = qstashUrl;
    process.env.QSTASH_TOKEN = qstashToken;
  });

  beforeAll(() => {
    process.env.QSTASH_URL = baseUrl;
    process.env.QSTASH_TOKEN = token;
  });

  test("should use env variables if parameters aren't passed", () => {
    const client = new Client();
    checkClient(client, baseUrl, token);
  });

  test("should use token variable if it's passed", () => {
    const newToken = nanoid();
    const client = new Client({ token: newToken });
    checkClient(client, baseUrl, newToken);
  });

  test("should use baseUrl variable if it's passed", () => {
    const newBaseUrl = nanoid();
    const client = new Client({ baseUrl: newBaseUrl });
    checkClient(client, newBaseUrl, token);
  });

  test("should use baseUrl variable if it's passed", () => {
    process.env.QSTASH_URL = undefined;
    const client = new Client();
    checkClient(client, "https://qstash.upstash.io", token);
  });
});
