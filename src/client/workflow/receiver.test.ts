/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * Tests the Receiver functionality.
 *
 * In the other workflow tests, Receiver is disabled. It's only enabled in
 * integration.test.ts which is not run in CI.
 *
 * Tests in this file cover cases when we expect the verification to fail
 * and to pass
 */

import { nanoid } from "ai";
import { describe, test, expect } from "bun:test";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { Receiver } from "../../receiver";
import { serve } from "./serve";
import {
  getRequestBody,
  MOCK_QSTASH_SERVER_URL,
  mockQStashServer,
  WORKFLOW_ENDPOINT,
} from "./test-utils";
import { Client } from "../client";
import {
  DEFAULT_CONTENT_TYPE,
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import type { Step } from "./types";

/**
 * Creates a signed request given the request url, method, body, signing key
 * and the headers.
 */
async function createSignedRequest({
  url,
  method,
  body,
  key,
  headers,
}: {
  url: string;
  method: string;
  body: string;
  key: string;
  headers?: Record<string, string>;
}) {
  // const base64body = btoa(body);

  const payload = {
    iss: "Upstash",
    sub: url,
    exp: Math.floor(Date.now() / 1000) + 300, // expires in 5 minutes
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    jti: `jwt_${Math.random().toString(36).slice(2, 15)}`,
    body: createHash("sha256").update(body).digest("base64url"),
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(Buffer.from(key, "utf8"));

  const allHeaders = new Headers(headers);
  allHeaders.append("Authorization", `Bearer <QSTASH_TOKEN>`);
  allHeaders.append("Upstash-Signature", jwt);

  return new Request(url, {
    method,
    headers: allHeaders,
    body: body,
  });
}

const currentSigningKey = nanoid();
const nextSigningKey = nanoid();

const randomBody = btoa(nanoid());

const token = nanoid();
const qstashClient = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });
const receiver = new Receiver({ currentSigningKey, nextSigningKey });

/**
 * endpoint to call in the receiver tests
 */
const endpoint = serve(
  async (context) => {
    await context.run("step 1", async () => {
      return await Promise.resolve("result");
    });
  },
  {
    qstashClient,
    receiver,
    url: WORKFLOW_ENDPOINT,
  }
);

describe("receiver", () => {
  describe("createSignedRequest helper", () => {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });

    test("should create valid token", async () => {
      const request = await createSignedRequest({
        url: WORKFLOW_ENDPOINT,
        method: "POST",
        body: randomBody,
        key: currentSigningKey,
      });

      await receiver.verify({
        signature: request.headers.get("upstash-signature") ?? "",
        body: randomBody,
        url: WORKFLOW_ENDPOINT,
      });
    });

    test("should create invalid token", async () => {
      const wrongUrl = "https://wrong-url.com";
      const request = await createSignedRequest({
        url: wrongUrl,
        method: "POST",
        body: randomBody,
        key: currentSigningKey,
      });

      const throws = () =>
        receiver.verify({
          signature: request.headers.get("upstash-signature") ?? "",
          body: randomBody,
          url: WORKFLOW_ENDPOINT,
        });

      expect(throws).toThrow(`invalid subject: ${wrongUrl}, want: ${WORKFLOW_ENDPOINT}`);
    });
  });

  describe("first invocation", () => {
    test("should block request without signature", async () => {
      const requestWithoutSignature = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: randomBody,
      });

      const throws = async () => {
        await endpoint(requestWithoutSignature);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: Error: `Upstash-Signature` header is not passed.\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });

    test("should block request with invalid signature", async () => {
      const requestWithoutSignature = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: randomBody,
        headers: {
          "Upstash-Signature": "incorrect-signature",
        },
      });

      const throws = async () => {
        await endpoint(requestWithoutSignature);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: SignatureError: Invalid Compact JWS\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });

    test("should allow request with signature", async () => {
      const body = { status: 200, body: randomBody };
      const requestWithHeader = await createSignedRequest({
        url: WORKFLOW_ENDPOINT,
        method: "POST",
        body: JSON.stringify(body),
        key: currentSigningKey,
      });

      let called = false;
      await mockQStashServer({
        execute: async () => {
          called = true;
          await endpoint(requestWithHeader);
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
          token,
          body,
        },
      });
      expect(called).toBeTrue();
    });
  });

  describe("third party result", () => {
    test("should block request without signature", async () => {
      const thirdPartyRequestWithoutHeader = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: randomBody,
        headers: {
          "Upstash-Workflow-Callback": "true",
          [WORKFLOW_ID_HEADER]: "wfr-23",
          "Upstash-Workflow-StepId": "4",
          "Upstash-Workflow-StepName": "my-step",
          "Upstash-Workflow-StepType": "Run",
          "Upstash-Workflow-Concurrent": "1",
          "Upstash-Workflow-ContentType": DEFAULT_CONTENT_TYPE,
        },
      });

      const throws = async () => {
        await endpoint(thirdPartyRequestWithoutHeader);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: Error: `Upstash-Signature` header is not passed.\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });

    test("should block request with invalid signature", async () => {
      const thirdPartyRequestWithoutHeader = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: randomBody,
        headers: {
          "Upstash-Workflow-Callback": "true",
          [WORKFLOW_ID_HEADER]: "wfr-23",
          "Upstash-Signature": "incorrect-signature",
          "Upstash-Workflow-StepId": "4",
          "Upstash-Workflow-StepName": "my-step",
          "Upstash-Workflow-StepType": "Run",
          "Upstash-Workflow-Concurrent": "1",
          "Upstash-Workflow-ContentType": DEFAULT_CONTENT_TYPE,
        },
      });

      const throws = async () => {
        await endpoint(thirdPartyRequestWithoutHeader);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: SignatureError: Invalid Compact JWS\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });

    test("should allow request with signature", async () => {
      const body = JSON.stringify({ status: 200, body: randomBody });
      const thirdPartyRequestWithHeader = await createSignedRequest({
        url: WORKFLOW_ENDPOINT,
        method: "POST",
        body,
        key: currentSigningKey,
        headers: {
          "Upstash-Workflow-Callback": "true",
          [WORKFLOW_ID_HEADER]: "wfr-23",
          "Upstash-Workflow-StepId": "4",
          "Upstash-Workflow-StepName": "my-step",
          "Upstash-Workflow-StepType": "Run",
          "Upstash-Workflow-Concurrent": "1",
          "Upstash-Workflow-ContentType": DEFAULT_CONTENT_TYPE,
        },
      });

      let called = false;
      await mockQStashServer({
        execute: async () => {
          called = true;
          await endpoint(thirdPartyRequestWithHeader);
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
          token,
          body: {
            stepId: 4,
            stepName: "my-step",
            stepType: "Run",
            out: atob(randomBody),
            concurrent: 1,
          },
        },
      });
      expect(called).toBeTrue();
    });
  });

  describe("normal invocation", () => {
    const workflowRunId = nanoid();
    const initialPayload = nanoid();
    const step: Step = {
      stepId: 1,
      stepName: "step 1",
      stepType: "Run",
      out: "result",
      concurrent: 1,
    };

    test("should block request without signature", async () => {
      const requestWithoutHeader = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: getRequestBody(initialPayload, [step]),
        headers: {
          [WORKFLOW_ID_HEADER]: workflowRunId,
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
        },
      });

      const throws = async () => {
        await endpoint(requestWithoutHeader);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: Error: `Upstash-Signature` header is not passed.\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });
    test("should block request with invalid signature", async () => {
      const requestWithoutHeader = new Request(WORKFLOW_ENDPOINT, {
        method: "POST",
        body: getRequestBody(initialPayload, [step]),
        headers: {
          "Upstash-Signature": "some-signature",
          [WORKFLOW_ID_HEADER]: workflowRunId,
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
        },
      });

      const throws = async () => {
        await endpoint(requestWithoutHeader);
      };

      await mockQStashServer({
        // eslint-disable-next-line @typescript-eslint/require-await
        execute: async () => {
          expect(throws).toThrow(
            "Failed to verify that the Workflow request comes from QStash: SignatureError: Invalid Compact JWS\n\nIf signature is missing, trigger the workflow endpoint by publishing your request to QStash instead of calling it directly.\n\nIf you want to disable QStash Verification, you should clear env variables QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY"
          );
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: false,
      });
    });
    test("should allow request with signature", async () => {
      const thirdPartyRequestWithHeader = await createSignedRequest({
        url: WORKFLOW_ENDPOINT,
        method: "POST",
        body: getRequestBody(initialPayload, [step]),
        key: currentSigningKey,
        headers: {
          [WORKFLOW_ID_HEADER]: workflowRunId,
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
        },
      });

      let called = false;
      await mockQStashServer({
        execute: async () => {
          called = true;
          await endpoint(thirdPartyRequestWithHeader);
        },
        responseFields: { body: "msgId", status: 200 },
        receivesRequest: {
          method: "DELETE",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/workflows/runs/${workflowRunId}?cancel=false`,
          token,
        },
      });
      expect(called).toBeTrue();
    });
  });
});
