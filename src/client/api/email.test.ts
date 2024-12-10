import { describe, test } from "bun:test";
import { Client } from "../client";
import { resend } from "./email";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";

describe("email", () => {
  const qstashToken = nanoid();
  const resendToken = nanoid();

  const globalHeader = "global-header";
  const globalHeaderOverwritten = "global-header-overwritten";
  const requestHeader = "request-header";

  const globalHeaderValue = nanoid();
  const overWrittenOldValue = nanoid();
  const overWrittenNewValue = nanoid();
  const requestHeaderValue = nanoid();

  const client = new Client({
    baseUrl: MOCK_QSTASH_SERVER_URL,
    token: qstashToken,
    headers: {
      [globalHeader]: globalHeaderValue,
      [globalHeaderOverwritten]: overWrittenOldValue,
    },
  });

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
          headers: {
            "content-type": "application/json",
            [globalHeaderOverwritten]: overWrittenNewValue,
            [requestHeader]: requestHeaderValue,
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
          "content-type": "application/json",
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${resendToken}`,
          [`upstash-forward-${requestHeader}`]: requestHeaderValue,
          [`upstash-forward-${globalHeader}`]: globalHeaderValue,
          [`upstash-forward-${globalHeaderOverwritten}`]: overWrittenNewValue,
          "upstash-method": "POST",
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
            "content-type": "application/json",
            [globalHeaderOverwritten]: overWrittenNewValue,
            [requestHeader]: requestHeaderValue,
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
          "upstash-method": "POST",
          "content-type": "application/json",
          [`upstash-forward-${requestHeader}`]: requestHeaderValue,
          [`upstash-forward-${globalHeader}`]: globalHeaderValue,
          [`upstash-forward-${globalHeaderOverwritten}`]: overWrittenNewValue,
        },
      },
    });
  });

  test("should be able to overwrite method", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "email",
            provider: resend({ token: resendToken, batch: true }),
          },
          method: "PUT",
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
          "upstash-method": "PUT",
        },
      },
    });
  });

  test("should be able to enqueue", async () => {
    const queueName = "resend-queue";
    const queue = client.queue({ queueName });
    await mockQStashServer({
      execute: async () => {
        await queue.enqueueJSON({
          api: {
            name: "email",
            provider: resend({ token: resendToken, batch: true }),
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
          headers: {
            "content-type": "application/json",
            [globalHeaderOverwritten]: overWrittenNewValue,
            [requestHeader]: requestHeaderValue,
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
        url: "http://localhost:8080/v2/enqueue/resend-queue/https://api.resend.com/emails/batch",
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
          "upstash-method": "POST",
          [`upstash-forward-${requestHeader}`]: requestHeaderValue,
          [`upstash-forward-${globalHeader}`]: globalHeaderValue,
          [`upstash-forward-${globalHeaderOverwritten}`]: overWrittenNewValue,
        },
      },
    });
  });
});
