/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer, expectToReject } from "./workflow/test-utils";

describe("url group empty id guard", () => {
  test("should not send request when get is called with an empty string", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        await expectToReject(() => mockClient.urlGroups.get(""), "Url group name cannot be empty");
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });

  test("should not send request when delete is called with an empty string", async () => {
    await mockQStashServer({
      execute: async () => {
        const mockClient = new Client({
          token: "mock-token",
          baseUrl: MOCK_QSTASH_SERVER_URL,
        });
        await expectToReject(
          () => mockClient.urlGroups.delete(""),
          "Url group name cannot be empty"
        );
      },
      responseFields: { body: {}, status: 200 },
      receivesRequest: false,
    });
  });
});

describe("url group", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should create a url group, check and delete it", async () => {
    const endpoint = { name: "url-group1", url: "https://oz.requestcatcher.com" };
    await client.urlGroups.addEndpoints({
      endpoints: [endpoint],
      name: "my-proxy-url-group",
    });

    const urlGroup = await client.urlGroups.get("my-proxy-url-group");
    await client.urlGroups.delete("my-proxy-url-group");
    expect(urlGroup.endpoints).toContainEqual(endpoint);
  });

  test("should create a url group, and add one more endpoint then delete it", async () => {
    const endpoint = { name: "urlGroup1", url: "https://oz.requestcatcher.com" };
    const endpoint1 = { name: "urlGroup2", url: "https://oz1.requestcatcher.com" };

    await client.urlGroups.addEndpoints({
      endpoints: [endpoint],
      name: "my-proxy-url-group",
    });

    await client.urlGroups.get("my-proxy-url-group");
    await client.urlGroups.addEndpoints({ name: "my-proxy-url-group", endpoints: [endpoint1] });

    const list = await client.urlGroups.list();
    await client.urlGroups.delete("my-proxy-url-group");

    expect(list[0].endpoints).toContainEqual(endpoint);
    expect(list[0].endpoints).toContainEqual(endpoint1);
  });
});
