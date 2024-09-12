import type { HTTPMethods } from "../types";
import type { Step, StepFunction, StepOptions, StepType } from "./types";

/**
 * Base class outlining steps. Basically, each step kind (run/sleep/sleepUntil)
 * should have two methods: getPlanStep & getResultStep.
 *
 * getPlanStep works the same way for all so it's implemented here.
 * The different step types will implement their own getResultStep method.
 */
export abstract class BaseLazyStep<TResult = unknown> {
  public readonly stepName;
  public readonly options: StepOptions;

  public abstract readonly stepType: StepType; // will be set in the subclasses

  constructor(stepName: string, options?: StepOptions) {
    this.stepName = stepName;
    this.options = { stepName: this.stepName, ...options };
  }

  /**
   * plan step to submit when step will run parallel with other
   * steps (parallel call state `first`)
   *
   * @param concurrent number of steps running parallel
   * @param targetStep target step id corresponding to this step
   * @returns
   */
  public abstract getPlanStep(concurrent: number, targetStep: number): Step<undefined>;

  /**
   * result step to submit after the step executes. Used in single step executions
   * and when a plan step executes in parallel executions (parallel call state `partial`).
   *
   * @param concurrent
   * @param stepId
   */
  public abstract getResultStep(concurrent: number, stepId: number): Promise<Step<TResult>>;
}

/**
 * Lazy step definition for `context.run` case
 */
export class LazyFunctionStep<TResult = unknown> extends BaseLazyStep<TResult> {
  private readonly stepFunction: StepFunction<TResult>;
  stepType: StepType = "Run";

  constructor(stepName: string, stepFunction: StepFunction<TResult>, options?: StepOptions) {
    super(stepName, options);
    this.stepFunction = stepFunction;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        stepType: this.stepType,
        concurrent,
        targetStep,
        nextStepOptions: this.options,
      };
    }
  }

  public async getResultStep(concurrent: number, stepId: number): Promise<Step<TResult>> {
    let result = this.stepFunction();
    if (result instanceof Promise) {
      result = await result;
    }

    return {
      stepId,
      stepName: this.stepName,
      stepType: this.stepType,
      out: result,
      concurrent,
    };
  }
}

/**
 * Lazy step definition for `context.sleep` case
 */
export class LazySleepStep extends BaseLazyStep {
  private readonly sleep: number;
  stepType: StepType = "SleepFor";

  constructor(stepName: string, sleep: number, options?: StepOptions) {
    super(stepName, options);
    this.sleep = sleep;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        stepType: this.stepType,
        sleepFor: this.sleep,
        concurrent,
        targetStep,
        nextStepOptions: this.options,
      };
    }
  }

  public async getResultStep(concurrent: number, stepId: number): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      stepType: this.stepType,
      sleepFor: this.sleep,
      concurrent,
    });
  }
}

/**
 * Lazy step definition for `context.sleepUntil` case
 */
export class LazySleepUntilStep extends BaseLazyStep {
  private readonly sleepUntil: number;
  stepType: StepType = "SleepUntil";

  constructor(stepName: string, sleepUntil: number, options?: StepOptions) {
    super(stepName, options);
    this.sleepUntil = sleepUntil;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        stepType: this.stepType,
        sleepUntil: this.sleepUntil,
        concurrent,
        targetStep,
        nextStepOptions: this.options,
      };
    }
  }

  public async getResultStep(concurrent: number, stepId: number): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      stepType: this.stepType,
      sleepUntil: this.sleepUntil,
      concurrent,
    });
  }
}

export class LazyCallStep<TResult = unknown, TBody = unknown> extends BaseLazyStep<TResult> {
  private readonly url: string;
  private readonly method: HTTPMethods;
  private readonly body: TBody;
  private readonly headers: Record<string, string>;
  stepType: StepType = "Call";

  constructor(
    stepName: string,
    url: string,
    method: HTTPMethods,
    body: TBody,
    headers: Record<string, string>,
    options?: StepOptions
  ) {
    super(stepName, options);
    this.url = url;
    this.method = method;
    this.body = body;
    this.headers = headers;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        stepType: this.stepType,
        concurrent,
        targetStep,
        nextStepOptions: this.options,
      };
    }
  }

  public async getResultStep(concurrent: number, stepId: number): Promise<Step<TResult>> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      stepType: this.stepType,
      concurrent,
      callUrl: this.url,
      callMethod: this.method,
      callBody: this.body,
      callHeaders: this.headers,
    });
  }
}
