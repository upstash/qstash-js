import { describe, test } from "bun:test";
import { Client } from "../client";
import { resend } from "./email";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";

describe("email", () => {
  const qstashToken = nanoid();
  const resendToken = nanoid();
  const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token: qstashToken });

  const header = "my-header";
  const headerValue = "my-header-value";

  test("should use resend", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "email",
            provider: resend({ token: resendToken }),
          },
          headers: {
            [header]: headerValue,
          },
          body: {
            from: "Acme <onboarding@resend.dev>",
            to: ["delivered@resend.dev"],
            subject: "hello world",
            html: "<p>it works!</p>",
          },
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://api.resend.com/emails",
        body: {
          from: "Acme <onboarding@resend.dev>",
          to: ["delivered@resend.dev"],
          subject: "hello world",
          html: "<p>it works!</p>",
        },
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${resendToken}`,
          "content-type": "application/json",
          [`upstash-forward-${header}`]: headerValue,
        },
      },
    });
  });

  test("should use resend with batch", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "email",
            provider: resend({ token: resendToken, batch: true }),
          },
          headers: {
            [header]: headerValue,
          },
          body: [
            {
              from: "Acme <onboarding@resend.dev>",
              to: ["foo@gmail.com"],
              subject: "hello world",
              html: "<h1>it works!</h1>",
            },
            {
              from: "Acme <onboarding@resend.dev>",
              to: ["bar@outlook.com"],
              subject: "world hello",
              html: "<p>it works!</p>",
            },
          ],
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: "http://localhost:8080/v2/publish/https://api.resend.com/emails/batch",
        body: [
          {
            from: "Acme <onboarding@resend.dev>",
            to: ["foo@gmail.com"],
            subject: "hello world",
            html: "<h1>it works!</h1>",
          },
          {
            from: "Acme <onboarding@resend.dev>",
            to: ["bar@outlook.com"],
            subject: "world hello",
            html: "<p>it works!</p>",
          },
        ],
        headers: {
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${resendToken}`,
          "content-type": "application/json",
          [`upstash-forward-${header}`]: headerValue,
        },
      },
    });
  });
});
