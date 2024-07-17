import type { AsyncStepFunction, Step } from "./types";

/**
 * Base class outlining steps. Basically, each step kind (run/sleep/sleepUntil)
 * should have two methods: getPlanStep & getResultStep.
 *
 * getPlanStep works the same way for all so it's implemented here.
 * The different step types will implement their own getResultStep method.
 */
export abstract class BaseLazyStep<TResult = unknown> {
  public readonly stepName;
  constructor(stepName: string) {
    this.stepName = stepName;
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
   * @param stepId
   */
  public abstract getResultStep(stepId: number, singleStep: boolean): Promise<Step<TResult>>;
}

/**
 * Lazy step definition for `context.run` case
 */
export class LazyFunctionStep<TResult = unknown> extends BaseLazyStep<TResult> {
  private readonly stepFunction: AsyncStepFunction<TResult>;

  constructor(stepName: string, stepFunction: AsyncStepFunction<TResult>) {
    super(stepName);
    this.stepFunction = stepFunction;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        concurrent,
        targetStep,
      };
    }
  }

  public async getResultStep(stepId: number, _singleStep: boolean): Promise<Step<TResult>> {
    const result = await this.stepFunction();

    return {
      stepId,
      stepName: this.stepName,
      out: result,
      concurrent: 1,
      targetStep: 0,
    };
  }
}

/**
 * Lazy step definition for `context.sleep` case
 */
export class LazySleepStep extends BaseLazyStep {
  private readonly sleep: number;

  constructor(stepName: string, sleep: number) {
    super(stepName);
    this.sleep = sleep;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        sleepFor: this.sleep,
        concurrent,
        targetStep,
      };
    }
  }

  public async getResultStep(stepId: number, singleStep: boolean): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      // apply sleepFor if the step is running by itself. If it's running parallel,
      // the sleepFor is already applied in the plan step
      sleepFor: singleStep ? this.sleep : undefined,
      concurrent: 1,
      targetStep: 0,
    });
  }
}

/**
 * Lazy step definition for `context.sleepUntil` case
 */
export class LazySleepUntilStep extends BaseLazyStep {
  private readonly sleepUntil: number;

  constructor(stepName: string, sleepUntil: number) {
    super(stepName);
    this.sleepUntil = sleepUntil;
  }

  public getPlanStep(concurrent: number, targetStep: number): Step<undefined> {
    {
      return {
        stepId: 0,
        stepName: this.stepName,
        sleepUntil: this.sleepUntil,
        concurrent,
        targetStep,
      };
    }
  }

  public async getResultStep(stepId: number, singleStep: boolean): Promise<Step> {
    return await Promise.resolve({
      stepId,
      stepName: this.stepName,
      // apply sleepUntil if the step is running by itself. If it's running parallel,
      // the sleepUntil is already applied in the plan step
      sleepUntil: singleStep ? this.sleepUntil : undefined,
      concurrent: 1,
      targetStep: 0,
    });
  }
}
