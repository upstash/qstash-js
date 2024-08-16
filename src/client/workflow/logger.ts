const LOG_LEVELS = ["DEBUG", "INFO", "SUBMIT", "WARN", "ERROR"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
type ChatLogEntry = {
  timestamp: number;
  logLevel: LogLevel;
  eventType:
    | "ENDPOINT_START" // when the endpoint is called
    | "SUBMIT_THIRD_PARTY_RESULT" // third party call result
    | "CREATE_CONTEXT" // isFirstInvocation, workflowRunId, headers, url and initialPayload and steps (steps only in DEBUG)
    | "SUBMIT_FIRST_INVOCATION" // if triggerFirstInvocation is called
    | "RUN_SINGLE"
    | "RUN_PARALLEL"
    | "SUBMIT_STEP"
    | "SUBMIT_CLEANUP" // cleanup when a workflow ends
    | "RESPONSE_WORKFLOW" // when onStepFinish is called with workflowRunId
    | "RESPONSE_DEFAULT" // when onStepFinish("no-workflow-id") is called
    | "ERROR"; // when onStepFinish("no-workflow-id") is called
  details: unknown;
};
export type WorkflowLoggerOptions = {
  logLevel: LogLevel;
  logOutput: "console";
};

export class WorkflowLogger {
  private logs: ChatLogEntry[] = [];
  private options: WorkflowLoggerOptions;

  constructor(options: WorkflowLoggerOptions) {
    this.options = options;
  }

  public async log(
    level: LogLevel,
    eventType: ChatLogEntry["eventType"],
    details?: unknown
  ): Promise<void> {
    if (this.shouldLog(level)) {
      const timestamp = Date.now();
      const logEntry: ChatLogEntry = {
        timestamp,
        logLevel: level,
        eventType,
        details,
      };

      this.logs.push(logEntry);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.options.logOutput === "console") {
        this.writeToConsole(logEntry);
      }

      // Introduce a small delay to make the sequence more visible
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private writeToConsole(logEntry: ChatLogEntry): void {
    const JSON_SPACING = 2;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry, undefined, JSON_SPACING));
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.options.logLevel);
  }

  public static getLogger(verbose?: boolean | WorkflowLogger) {
    if (typeof verbose === "object") {
      return verbose;
    } else {
      return verbose
        ? new WorkflowLogger({
            logLevel: "INFO",
            logOutput: "console",
          })
        : undefined;
    }
  }
}
