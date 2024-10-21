import { describe, test } from "bun:test";
import { Client } from "../client";
import { resend } from "./email";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";

describe("email", () => {
  const qstashToken = nanoid();
  const resendToken = nanoid();
  const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token: qstashToken });

  test("should use resend", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "email",
            provider: resend({ token: resendToken }),
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
          "upstash-forward-authorization": resendToken,
        },
      },
    });
  });
});