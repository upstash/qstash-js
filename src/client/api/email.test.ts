/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, test } from "bun:test";
import { Client } from "../client";
import { resend } from "./email";

describe("email", () => {
  const client = new Client({ token: process.env.QSTASH_TOKEN! });

  test("should use resend", async () => {
    await client.publishJSON({
      api: {
        name: "email",
        provider: resend({ token: process.env.RESEND_TOKEN! }),
      },
      body: {
        from: "Acme <onboarding@resend.dev>",
        to: ["delivered@resend.dev"],
        subject: "hello world",
        html: "<p>it works!</p>",
      },
    });
  });
});
