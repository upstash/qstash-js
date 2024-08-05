/**
 * # End-to-end workflow tests
 *
 * In these tests, we define workflow endpoints using QStash serve method and
 * creating an HTTP server with them (see `testEndpoint` method). After creating
 * the workflow endpoint, `testEndpoint` makes the initial request to the endpoint.
 *
 * Endpoint calls QStash and a workflow execution commences. We wait for some time
 * before killing the server. After killing the server, we check:
 * - the number of times the endpoint was called
 * - whether the route reached it's end (see `FinishState`)
 *
 * # How to run
 *
 * Since these tests require a local tunnel or a local QStash server, we can't run
 * them in CI. So they are skipped. But they are still useful for local development.
 *
 * ## With Local QStash Server
 *
 * To run the tests, you can locally run the QStash server at localhost:8000. Don't
 * forget to set the QSTASH_TOKEN and QSTASH_URL environemnt variables after
 * starting the server.
 *
 * ## With Ngrok
 *
 * Alternative to running QStash locally is to expose the localhost endpoints
 * with local tunneling using Ngrok. To make this easier, we have added a bash
 * script `integration.sh`. To run the script, first get your ngrok token from
 * https://dashboard.ngrok.com/get-started/your-authtoken and update the
 * `integration.yml` file with your token. Afterwards, run the bash script with:
 *
 * ```sh
 * bash integration.sh <QSTASH_URL> <QSTASH_TOKEN>
 * ```
 *
 * You can find the values of these variables from Upstash console.
 *
 * The script will:
 * - start a Ngrok local tunnel, exposing ports 3000 and 3001
 * - update the integration test by disabling skip and updating the
 *   URLs with the ones from Ngrok tunnel
 * - run the tests
 *
 * You may want to increase the `waitFor` and `timeout` parameters of the tests
 * because network takes some time.
 */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { serve } from "bun";
import { serve as workflowServe } from "./serve";
import { expect, test, describe } from "bun:test";
import { Client } from "../client";
import type { WorkflowContext } from "./context";

const WORKFLOW_PORT = "3000";
const THIRD_PARTY_PORT = "3001";
const LOCAL_WORKFLOW_URL = `http://localhost:${WORKFLOW_PORT}`;
const LOCAL_THIRD_PARTY_URL = `http://localhost:${THIRD_PARTY_PORT}`;

const someWork = (input: string) => {
  return `processed '${input}'`;
};

type Invoice = {
  date: number;
  email: string;
  amount: number;
};

type Charge = {
  invoice: Invoice;
  success: boolean;
};

class FinishState {
  public finished = false;
  public finish() {
    this.finished = true;
  }
  public check() {
    expect(this.finished).toBeTrue();
  }
}

let counter = 0;
const attemptCharge = () => {
  counter += 1;
  if (counter === 3) {
    counter = 0;
    return true;
  }
  return false;
};

const client = new Client({
  baseUrl: process.env.MOCK_QSTASH_URL,
  token: process.env.MOCK_QSTASH_TOKEN ?? "",
});

const testEndpoint = async <TInitialPayload = unknown>({
  finalCount,
  waitFor,
  initialPayload,
  routeFunction,
  finishState,
}: {
  finalCount: number;
  waitFor: number;
  initialPayload: TInitialPayload;
  routeFunction: (context: WorkflowContext<TInitialPayload>) => Promise<void>;
  finishState: FinishState;
}) => {
  let counter = 0;

  const endpoint = workflowServe<TInitialPayload>({
    routeFunction,
    options: {
      client,
      url: LOCAL_WORKFLOW_URL,
      verbose: true,
    },
  });

  const server = serve({
    async fetch(request) {
      counter += 1;
      return await endpoint(request);
    },
    port: WORKFLOW_PORT,
  });

  // make the initial request:
  const body = initialPayload
    ? typeof initialPayload === "string"
      ? initialPayload
      : JSON.stringify(initialPayload)
    : undefined;
  await fetch(`http://localhost:${WORKFLOW_PORT}`, {
    method: "POST",
    body,
    headers: {
      Authentication: "Bearer secretPassword",
    },
  });

  await new Promise((resolve) => setTimeout(resolve, waitFor));

  server.stop();

  finishState.check();
  expect(counter).toBe(finalCount);
};

describe.skip("live serve tests", () => {
  test(
    "path endpoint",
    async () => {
      const finishState = new FinishState();
      await testEndpoint({
        finalCount: 4,
        waitFor: 5000,
        initialPayload: "my-payload",
        finishState,
        routeFunction: async (context) => {
          const input = context.requestPayload;

          expect(input).toBe("my-payload");

          const result1 = await context.run("step1", async () => {
            return await Promise.resolve(someWork(input));
          });

          expect(result1).toBe("processed 'my-payload'");

          const result2 = await context.run("step2", async () => {
            // console.log("step2 ran", result1);
            const result = someWork(result1);
            return await Promise.resolve(result);
          });

          expect(result2).toBe("processed 'processed 'my-payload''");
          finishState.finish();
        },
      });
    },
    {
      timeout: 10_000,
    }
  );

  test(
    "path sleep",

    async () => {
      const finishState = new FinishState();
      await testEndpoint({
        finalCount: 6,
        waitFor: 20_000,
        initialPayload: undefined,
        finishState,
        routeFunction: async (context) => {
          const input = context.requestPayload;
          expect(input).toBeUndefined();

          const result1 = await context.run("step1", async () => {
            const output = 123;
            return output;
          });
          expect(result1).toBe(123);

          await context.sleepUntil("sleep1", Date.now() / 1000 + 3);

          const result2 = await context.run("step2", async () => {
            const output = 234;
            return output;
          });
          expect(result2).toBe(234);

          await context.sleep("sleep2", 2);

          const result3 = await context.run("step3", async () => {
            const output = 345;
            return output;
          });
          expect(result3).toBe(345);
          finishState.finish();
        },
      });
    },
    {
      timeout: 25_000,
    }
  );

  test(
    "sleepWithoutAwait endpoint",
    async () => {
      const payload = { date: 123, email: "my@mail.com", amount: 10 };
      const finishState = new FinishState();
      await testEndpoint<Invoice>({
        finalCount: 13,
        waitFor: 20_000,
        initialPayload: payload,
        finishState,
        routeFunction: async (context) => {
          const invoice = context.requestPayload;
          expect(invoice).toEqual(payload);

          for (let index = 0; index < 3; index++) {
            const charge = await context.run("attemptCharge", async () => {
              const success = attemptCharge();
              const charge: Charge = { invoice, success };
              return charge;
            });

            if (charge.success) {
              const [updateDb, receipt, sleepResult] = await Promise.all([
                context.run("updateDb", async () => {
                  return charge.invoice.amount;
                }),
                context.run("sendReceipt", async () => {
                  return charge.invoice.email;
                }),
                context.sleep("sleep", 5),
              ]);
              expect(updateDb).toBe(10);
              expect(receipt).toBe("my@mail.com");
              expect(sleepResult).toBeUndefined();
              finishState.finish();
              return;
            }
            await context.sleep("retrySleep", 2);
          }
          await context.run("paymentFailed", async () => {
            return true;
          });
        },
      });
    },
    {
      timeout: 25_000,
    }
  );

  test(
    "auth endpoint",
    async () => {
      const finishState = new FinishState();
      await testEndpoint({
        finalCount: 4,
        waitFor: 5000,
        initialPayload: "my-payload",
        finishState,
        routeFunction: async (context) => {
          if (context.headers.get("authentication") !== "Bearer secretPassword") {
            console.error("Authentication failed.");
            return;
          }

          const input = context.requestPayload;

          expect(input).toBe("my-payload");

          const result1 = await context.run("step1", async () => {
            return await Promise.resolve(someWork(input));
          });

          expect(result1).toBe("processed 'my-payload'");

          const result2 = await context.run("step2", async () => {
            // console.log("step2 ran", result1);
            const result = someWork(result1);
            return await Promise.resolve(result);
          });

          expect(result2).toBe("processed 'processed 'my-payload''");
          finishState.finish();
        },
      });
    },
    {
      timeout: 10_000,
    }
  );

  test(
    "call endpoint",
    async () => {
      const thirdPartyResult = "third-party-result";
      const postHeader = {
        "post-header": "post-header-value-x",
      };
      const getHeader = {
        "get-header": "get-header-value-x",
      };
      const thirdPartyServer = serve({
        async fetch(request) {
          if (request.method === "GET") {
            return new Response(
              `called GET '${thirdPartyResult}' '${request.headers.get("get-header")}'`,
              {
                status: 200,
              }
            );
          } else if (request.method === "POST") {
            return new Response(
              `called POST '${thirdPartyResult}' '${request.headers.get("post-header")}' '${await request.text()}'`,
              {
                status: 200,
              }
            );
          } else {
            return new Response("method not allowed", { status: 400 });
          }
        },
        port: THIRD_PARTY_PORT,
      });

      const finishState = new FinishState();
      await testEndpoint({
        finalCount: 6,
        waitFor: 10_000,
        initialPayload: "my-payload",
        finishState,
        routeFunction: async (context) => {
          if (context.headers.get("authentication") !== "Bearer secretPassword") {
            console.error("Authentication failed.");
            return;
          }

          const postResult = await context.call<string>(
            "post call",
            LOCAL_THIRD_PARTY_URL,
            "POST",
            "post-payload",
            postHeader
          );
          expect(postResult).toBe(
            "called POST 'third-party-result' 'post-header-value-x' '\"post-payload\"'"
          );

          await context.sleep("sleep 1", 2);

          const getResult = await context.call<string>(
            "get call",
            LOCAL_THIRD_PARTY_URL,
            "GET",
            undefined,
            getHeader
          );

          expect(getResult).toBe("called GET 'third-party-result' 'get-header-value-x'");
          finishState.finish();
        },
      });

      thirdPartyServer.stop();
    },
    {
      timeout: 15_000,
    }
  );
});
