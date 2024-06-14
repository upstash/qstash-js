/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, test } from "bun:test";
import { Client } from "./client";

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
