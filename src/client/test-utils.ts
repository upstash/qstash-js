const EVENTUALLY_TIMEOUT = 5000;

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
