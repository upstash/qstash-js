import type { AsyncStepFunction, InitialPayloadParser, Step } from "./types";
import { nanoid } from "nanoid";
import {
  WORKFLOW_ID_HEADER,
  WORKFLOW_INIT_HEADER,
  WORKFLOW_PROTOCOL_VERSION,
  WORKFLOW_PROTOCOL_VERSION_HEADER,
} from "./constants";
import { QstashWorkflowError } from "../error";
import * as WorkflowParser from "./workflow-parser";
import type { Client } from "../client";
import { AutoExecutor } from "./auto-executor";

export class WorkflowContext<TInitialPayload = unknown> {
  protected readonly executor: AutoExecutor;
  public readonly client: Client;
  public readonly workflowId: string;
  public readonly steps: Step[];
  public readonly nonPlanStepCount: number;
  public readonly url: string;
  public readonly requestPayload: TInitialPayload;

  constructor({
    client,
    workflowId,
    initialPayload,
    steps,
    url,
  }: {
    client: Client;
    workflowId: string;
    initialPayload: TInitialPayload;
    steps: Step[];
    url: string;
  }) {
    this.client = client;
    this.workflowId = workflowId;
    this.steps = steps;
    this.url = url;
    this.requestPayload = initialPayload;
    this.nonPlanStepCount = this.steps.filter((step) => !step.targetStep).length;

    this.executor = new AutoExecutor(this);
  }

  /**
   * Executes a workflow step
   *
   * ```typescript
   * const result = await context.run("step 1", async () => {
   *   return await Promise.resolve("result")
   * })
   * ```
   *
   * Can also be called in parallel and the steps will be executed
   * simulatenously:
   *
   * ```typescript
   * const [result1, result2] = await Promise.all([
   *   context.run("step 1", async () => {
   *     return await Promise.resolve("result1")
   *   })
   *   context.run("step 2", async () => {
   *     return await Promise.resolve("result2")
   *   })
   * ])
   * ```
   *
   * @param stepName name of the step
   * @param stepFunction step function to be executed
   * @returns result of the step function
   */
  public async run<TResult>(
    stepName: string,
    stepFunction: AsyncStepFunction<TResult>
  ): Promise<TResult> {
    return this.executor.addFunctionStep(stepName, stepFunction);
  }

  /**
   * Stops the execution for the duration provided.
   *
   * @param stepName
   * @param duration sleep duration in seconds
   * @returns
   */
  public async sleep(stepName: string, duration: number): Promise<void> {
    await this.executor.addSleepStep(stepName, duration);
  }

  /**
   * Stops the execution until the date time provided.
   *
   * @param stepName
   * @param datetime time to sleep until. Can be provided as a number (in unix seconds),
   *   as a Date object or a string (passed to `new Date(datetimeString)`)
   * @returns
   */
  public async sleepUntil(stepName: string, datetime: Date | string | number): Promise<void> {
    let time: number;
    if (typeof datetime === "number") {
      time = datetime;
    } else {
      datetime = typeof datetime === "string" ? new Date(datetime) : datetime;
      // get unix seconds
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      time = Math.round(datetime.getTime() / 1000);
    }
    await this.executor.addSleepUntilStep(stepName, time);
  }

  /**
   * Checks request headers and body
   * - Checks workflow header to determine whether the request is the first request
   * - Gets the workflow id
   * - Parses payload
   * - Returns the steps. If it's the first invocation, steps are empty.
   *   Otherwise, steps are generated from the request body.
   *
   * @param request Request received
   * @returns Whether the invocation is the initial one, the workflow id and the steps
   */
  private static async parseRequest(request: Request): Promise<{
    isFirstInvocation: boolean;
    workflowId: string;
    initialPayload: string;
    steps: Step[];
  }> {
    const versionHeader = request.headers.get(WORKFLOW_PROTOCOL_VERSION_HEADER);
    const isFirstInvocation = !versionHeader;

    // if it's not the first invocation, verify that the workflow protocal version is correct
    if (!isFirstInvocation && versionHeader !== WORKFLOW_PROTOCOL_VERSION) {
      throw new QstashWorkflowError(
        `Incompatible workflow sdk protocol version. Expected ${WORKFLOW_PROTOCOL_VERSION},` +
          ` got ${versionHeader} from the request.`
      );
    }

    // get workflow id
    const workflowId = isFirstInvocation
      ? `wf${nanoid()}`
      : request.headers.get(WORKFLOW_ID_HEADER) ?? "";
    if (workflowId.length === 0) {
      throw new QstashWorkflowError("Couldn't get workflow id from header");
    }

    // get payload as raw string
    const payload = await WorkflowParser.getPayload(request);

    if (isFirstInvocation) {
      // if first invocation, return and `serve` will handle publishing the JSON to QStash
      return {
        isFirstInvocation,
        workflowId,
        initialPayload: payload ?? "",
        steps: [],
      };
      // if not the first invocation, make sure that body is not empty and parse payload
    } else {
      if (!payload) {
        throw new QstashWorkflowError("Only first call can have an empty body");
      }
      const { initialPayload, steps } = WorkflowParser.parsePayload(payload);

      return {
        isFirstInvocation,
        workflowId,
        initialPayload,
        steps,
      };
    }
  }

  /**
   * Gets headers for calling QStash
   *
   * @param initHeaderValue Whether the invocation should create a new workflow
   * @returns
   */
  public getHeaders(initHeaderValue: "true" | "false") {
    return {
      [WORKFLOW_INIT_HEADER]: initHeaderValue,
      [WORKFLOW_ID_HEADER]: this.workflowId,
      [`Upstash-Forward-${WORKFLOW_PROTOCOL_VERSION_HEADER}`]: WORKFLOW_PROTOCOL_VERSION,
    };
  }

  /**
   * Creates a workflow from a request by parsing the body and checking the
   * headers.
   *
   * @param request request received from the API
   * @param client QStash client
   * @param initialPayloadParser function to parse the initial payload
   * @returns workflow and whether its the first time the workflow is being called
   */
  static async createContext<TInitialPayload = unknown>(
    request: Request,
    client: Client,
    initialPayloadParser: InitialPayloadParser<TInitialPayload>
  ) {
    const { isFirstInvocation, workflowId, initialPayload, steps } =
      await WorkflowContext.parseRequest(request);

    const workflowContext = new WorkflowContext<TInitialPayload>({
      client,
      workflowId,
      initialPayload: initialPayloadParser(initialPayload),
      steps,
      url: request.url,
    });

    return { workflowContext, isFirstInvocation };
  }
}
