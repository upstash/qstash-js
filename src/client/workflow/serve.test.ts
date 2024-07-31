/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/require-await */
import { describe, test } from "bun:test";
import { serve } from "./serve";
import {
  driveWorkflow,
  getRequest,
  MOCK_QSTASH_SERVER_URL,
  mockQstashServer,
  WORKFLOW_ENDPOINT,
} from "./test-utils";
import { nanoid } from "nanoid";
import { Client } from "../client";
import type { Step } from "./types";
import { WORKFLOW_INIT_HEADER, WORKFLOW_PROTOCOL_VERSION_HEADER } from "./constants";

const someWork = (input: string) => {
  return `processed '${input}'`;
};

const workflowId = `wf${nanoid()}`;
const token = nanoid();

const client = new Client({ baseUrl: MOCK_QSTASH_SERVER_URL, token });

describe("serve", () => {
  test("should send create workflow request in initial request", async () => {
    const endpoint = serve<string>({
      routeFunction: async (context) => {
        const _input = context.requestPayload;
      },
      options: {
        client,
        verbose: true,
      },
    });

    const initialPayload = nanoid();
    const request = new Request(WORKFLOW_ENDPOINT, { method: "POST", body: initialPayload });
    await mockQstashServer({
      execute: async () => {
        await endpoint(request);
      },
      responseFields: { body: "msgId", status: 200 },
      receivesRequest: {
        method: "POST",
        url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/${WORKFLOW_ENDPOINT}`,
        token,
        body: initialPayload,
        headers: {
          [WORKFLOW_INIT_HEADER]: "true",
          [WORKFLOW_PROTOCOL_VERSION_HEADER]: null,
          [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: "1",
        },
      },
    });
  });

  test.only("path endpoint", async () => {
    const endpoint = serve<string>({
      routeFunction: async (context) => {
        const input = context.requestPayload;

        const result1 = await context.run("step1", async () => {
          return someWork(input);
        });

        await context.run("step2", async () => {
          const result = someWork(result1);
          return result;
        });
      },
      options: {
        client,
        verbose: true,
      },
    });

    const initialPayload = "initial-payload";
    const steps: Step[] = [
      {
        stepId: 1,
        stepName: "step1",
        stepType: "Run",
        out: `processed '${initialPayload}'`,
        concurrent: 1,
        targetStep: 0,
      },
      {
        stepId: 2,
        stepName: "step2",
        stepType: "Run",
        out: `processed 'processed '${initialPayload}''`,
        concurrent: 1,
        targetStep: 0,
      },
    ];

    await driveWorkflow({
      execute: async (initialPayload, steps) => {
        const request = getRequest(WORKFLOW_ENDPOINT, workflowId, initialPayload, steps);
        await endpoint(request);
      },
      initialPayload,
      iterations: [
        {
          stepsToAdd: [],
          responseFields: { body: { messageId: "some-message-id" }, status: 200 },
          receivesRequest: {
            method: "POST",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
            token,
            body: [
              {
                body: JSON.stringify(steps[0]),
                destination: WORKFLOW_ENDPOINT,
                headers: {
                  "content-type": "application/json",
                  "upstash-forward-upstash-workflow-sdk-version": "1",
                  "upstash-method": "POST",
                  "upstash-workflow-id": workflowId,
                  "upstash-workflow-init": "false",
                  "upstash-workflow-url": WORKFLOW_ENDPOINT,
                },
              },
            ],
          },
        },
        {
          stepsToAdd: [steps[0]],
          responseFields: { body: { messageId: "some-message-id" }, status: 200 },
          receivesRequest: {
            method: "POST",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/batch`,
            token,
            body: [
              {
                destination: WORKFLOW_ENDPOINT,
                headers: {
                  "content-type": "application/json",
                  "upstash-forward-upstash-workflow-sdk-version": "1",
                  "upstash-method": "POST",
                  "upstash-workflow-id": workflowId,
                  "upstash-workflow-init": "false",
                  "upstash-workflow-url": WORKFLOW_ENDPOINT,
                },
                body: JSON.stringify(steps[1]),
              },
            ],
          },
        },
        {
          stepsToAdd: [steps[1]],
          responseFields: { body: "msgId", status: 200 },
          receivesRequest: {
            method: "DELETE",
            url: `${MOCK_QSTASH_SERVER_URL}/v2/workflows/${workflowId}?cancel=false`,
            token,
            body: undefined,
          },
        },
      ],
    });
  });
});
