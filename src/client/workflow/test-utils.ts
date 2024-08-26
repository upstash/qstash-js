import { expect } from "bun:test";
import { serve } from "bun";
import type { RawStep, Step } from "./types";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";

export const MOCK_QSTASH_SERVER_PORT = 8080;
export const MOCK_QSTASH_SERVER_URL = `http://localhost:${MOCK_QSTASH_SERVER_PORT}`;

export const MOCK_SERVER_URL = "https://requestcatcher.com/";
export const WORKFLOW_ENDPOINT = "https://www.my-website.com/api";

export type ResponseFields = {
  body: unknown;
  status: number;
};

export type RequestFields = {
  method: string;
  url: string;
  token: string;
  body?: unknown;
  headers?: Record<string, string | null>;
};

/**
 * Create a HTTP client to mock QStash. We pass the URL of the mock server
 * as baseUrl and verify that the request is as we expect.
 *
 * @param execute function which will call QStash
 * @param responseFields body and status of the response QStash returns
 * @param receivesRequest fields of the request sent to QStash as a result of running
 *    `await execute()`. If set to false, we assert that no request is sent.
 */
export const mockQStashServer = async ({
  execute,
  responseFields,
  receivesRequest,
}: {
  execute: () => unknown;
  responseFields: ResponseFields;
  receivesRequest: RequestFields | false;
}) => {
  const shouldBeCalled = Boolean(receivesRequest);
  let called = false;

  const server = serve({
    async fetch(request) {
      called = true;

      if (!receivesRequest) {
        return new Response("assertion in mock QStash failed. fetch shouldn't have been called.", {
          status: 400,
        });
      }
      const { method, url, token, body } = receivesRequest;
      try {
        expect(request.method).toBe(method);
        expect(request.url).toBe(url);
        expect(request.headers.get("authorization")).toBe(`Bearer ${token}`);
        // check body
        if (body) {
          expect(await request.json()).toEqual(body);
        } else {
          expect(await request.text()).toBeFalsy();
        }
        // check headers
        if (receivesRequest.headers) {
          for (const header in receivesRequest.headers) {
            const value = receivesRequest.headers[header];
            expect(request.headers.get(header)).toBe(value);
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error("Assertion error:", error.message);
          return new Response(`assertion in mock QStash failed.`, {
            status: 400,
          });
        }
      }
      return new Response(JSON.stringify(responseFields.body), {
        status: responseFields.status,
      });
    },
    port: MOCK_QSTASH_SERVER_PORT,
  });

  try {
    await execute();
    expect(called).toBe(shouldBeCalled);
  } catch (error) {
    server.stop(true);
    throw error;
  } finally {
    server.stop(true);
  }
};

type Iteration = {
  stepsToAdd: Step[];
  responseFields: ResponseFields;
  receivesRequest: RequestFields | false;
};

type IterationTape = Iteration[];

export const driveWorkflow = async ({
  execute,
  initialPayload,
  iterations,
}: {
  execute: (intialPayload: unknown, steps: Step[]) => Promise<void>;
  initialPayload: unknown;
  iterations: IterationTape;
}) => {
  const steps: Step[] = [];
  for (const { stepsToAdd, responseFields, receivesRequest } of iterations) {
    steps.push(...stepsToAdd);
    await mockQStashServer({
      execute: () => execute(initialPayload, steps),
      responseFields,
      receivesRequest,
    });
  }
};

/**
 * Returns a workflow request body given the initial payload and steps
 *
 * @param initialPayload payload sent by the user
 * @param steps steps of the workflow
 * @returns encoded and stringified request body as RawSteps
 */
export const getRequestBody = (initialPayload: unknown, steps: Step[]) => {
  const encodedInitialPayload = btoa(
    typeof initialPayload === "string" ? initialPayload : JSON.stringify(initialPayload)
  );
  const encodedInitialStep: RawStep = {
    messageId: "msgId",
    body: encodedInitialPayload,
    callType: "step",
  };
  const encodedSteps: RawStep[] = steps.map((step) => {
    return {
      messageId: "msgId",
      body: btoa(JSON.stringify(step)),
      callType: "step",
    };
  });
  return JSON.stringify([encodedInitialStep, ...encodedSteps]);
};

/**
 * Creates a workflow request
 *
 * @param workflowUrl workflow endpoint
 * @param workflowRunId workflow id
 * @param initialPayload payload sent by the user
 * @param steps steps of the workflow
 * @returns request given all the parameters above
 */
export const getRequest = (
  workflowUrl: string,
  workflowRunId: string,
  initialPayload: unknown,
  steps: Step[]
): Request => {
  return new Request(workflowUrl, {
    body: getRequestBody(initialPayload, steps),
    headers: {
      [WORKFLOW_ID_HEADER]: workflowRunId,
      [WORKFLOW_PROTOCOL_VERSION_HEADER]: WORKFLOW_PROTOCOL_VERSION,
    },
  });
};
