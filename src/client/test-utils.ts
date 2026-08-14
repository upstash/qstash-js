const EVENTUALLY_TIMEOUT = 5000;

/**
 * Removes the given environment variables for the duration of a test and
 * returns a function that puts them back.
 *
 * `process.env` types well-known keys (NODE_ENV) as readonly, so writes go
 * through a plain record view of it.
 */
export const stubEnvironment = (
  keys: string[]
): { environment: Record<string, string | undefined>; restore: () => void } => {
  const environment = process.env as Record<string, string | undefined>;
  const original = Object.fromEntries(keys.map((key) => [key, environment[key]]));

  for (const key of keys) Reflect.deleteProperty(environment, key);

  return {
    environment,
    restore: () => {
      for (const key of keys) {
        const value = original[key];
        if (value === undefined) {
          Reflect.deleteProperty(environment, key);
        } else {
          environment[key] = value;
        }
      }
    },
  };
};

/**
 * Runs `run` with console.warn captured, returning everything it logged.
 */
export const captureWarnings = (run: () => void): string[] => {
  const warnings: string[] = [];
  // eslint-disable-next-line no-console
  const originalWarn = console.warn;
  // eslint-disable-next-line no-console
  console.warn = (...arguments_: unknown[]) => {
    warnings.push(arguments_.map(String).join(" "));
  };
  try {
    run();
  } finally {
    // eslint-disable-next-line no-console
    console.warn = originalWarn;
  }
  return warnings;
};

export const eventually = async function (
  function_: () => Promise<void> | void,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> {
  const { timeout = EVENTUALLY_TIMEOUT, interval = 100 } = options;

  const startTime = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      await function_();
      // Success case - all assertions passed
      return;
    } catch (error) {
      const lastError = error as Error;
      if (Date.now() - startTime >= timeout) {
        throw new Error(`Assertions not satisfied within timeout: ${lastError.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
};
