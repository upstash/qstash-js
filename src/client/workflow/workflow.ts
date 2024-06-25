import { nanoid } from "nanoid";
import type { Step, StepFunction } from "./types";
import { internalHeader, workflowIdHeader } from "./types";
import type { Client } from "../client";

export class Workflow {
  private client: Client;
  private url: string;
  private stepCount = 0;
  private workflowId: string;
  private steps: Step[];
  private skip;
  // to accumulate steps in Promise.all
  private pendingSteps: Step[] = [];

  constructor({
    client,
    url,
    workflowId,
    steps,
    skip = false,
  }: {
    client: Client;
    url: string;
    workflowId: string;
    steps: Step[];
    skip: boolean;
  }) {
    this.client = client;
    this.url = url;
    this.workflowId = workflowId;
    this.steps = steps;
    this.skip = skip;
  }

  public async step<TResult>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    stepName: string,
    stepFunction: StepFunction<TResult>
  ): Promise<TResult> {
    this.stepCount += 1;
    if (this.skip) {
      // @ts-expect-error return undefined for skipped steps
      return;
    }

    if (this.stepCount < this.steps.length) {
      return this.steps[this.stepCount].out as TResult;
    }

    const result = await stepFunction();
    this.skip = true;

    // add result to pending and send request
    this.addResult(result);
    await this.sendPendingToQstash();

    return result;
  }

  private addResult(result: unknown) {
    this.addStep({
      stepId: this.stepCount,
      out: result,
      concurrent: 1,
      targetStep: 0,
    });
  }

  private addStep(step: Step | Step[]) {
    if (Array.isArray(step)) {
      this.pendingSteps = [...this.pendingSteps, ...step];
    }
    this.pendingSteps.push(step as Step);
  }

  private async invokeQstash(step: Step) {
    const headers: Record<string, string> = {
      [`Upstash-Forward-${internalHeader}`]: "yes",
      "Upstash-Forward-Upstash-Workflow-Id": this.workflowId,
      "Upstash-Workflow-Id": this.workflowId,
    };

    await this.client.publishJSON({
      headers: headers,
      method: "POST",
      body: JSON.stringify(step),
      url: this.url,
      notBefore: step.sleepUntil,
      delay: step.sleepFor,
    });
  }

  private async sendPendingToQstash() {
    // TODO: batch request for concurrent requests
    for (const step of this.pendingSteps) {
      await this.invokeQstash(step);
    }
    this.pendingSteps = [];
  }

  /**
   * STATIC METHODS
   */

  static async parseRequest(request: Request) {
    const callHeader = request.headers.get(internalHeader);
    const firstCall = !callHeader;

    const workflowId = firstCall ? `wf${nanoid()}` : request.headers.get(workflowIdHeader) ?? "";
    if (workflowId.length === 0) {
      throw new Error("Couldn't get workflow id from header");
    }

    let payload: string[] | undefined;
    try {
      payload = (await request.json()) as string[];
    } catch {
      payload = undefined;
    }

    let steps: Step[];
    if (firstCall) {
      steps = [
        {
          stepId: 0,
          out: payload,
          concurrent: 1,
          targetStep: 0,
        },
      ];
    } else {
      if (payload === undefined) {
        throw new Error("only first call can have empty payload");
      }

      steps = payload.map((rawStep) => {
        return JSON.parse(JSON.parse(Buffer.from(rawStep, "base64").toString()) as string) as Step;
      });
    }

    return {
      firstCall,
      workflowId,
      steps,
    };
  }

  static async createWorkflow(request: Request, client: Client) {
    const { firstCall, workflowId, steps } = await Workflow.parseRequest(request);
    const workflow = new Workflow({ client, workflowId, steps, skip: firstCall, url: request.url });

    if (firstCall) {
      await workflow.invokeQstash(steps[0]);
    }

    return workflow;
  }
}
