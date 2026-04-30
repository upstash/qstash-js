import { importChildProcess } from "./constants";

const STARTUP_TIMEOUT_MS = 30_000;
const PREFIX = "\u001B[2m[QStash CLI]\u001B[0m";

type Unrefable = { unref?: () => void };
type ChildProcess = {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  pid?: number;
  stdout: (NodeJS.ReadableStream & Unrefable) | null;
  stderr: (NodeJS.ReadableStream & Unrefable) | null;
} & Unrefable;

export const spawnServer = async (
  binaryPath: string,
  port: string,
  onUnexpectedExit?: () => void
): Promise<void> => {
  const childProcess = await importChildProcess();
  const child = await new Promise<ChildProcess>((resolve, reject) => {
    const child = childProcess.spawn(binaryPath, ["dev", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("[QStash Dev] Server failed to start within 30 seconds"));
    }, STARTUP_TIMEOUT_MS);

    let startupOutput = "";
    let started = false;

    // The CLI writes its FTL failure logs to stdout, so we buffer both streams pre-readiness.
    const bufferLine = (line: string) => {
      if (!started) startupOutput += `${line}\n`;
    };

    forwardWithPrefix(child.stdout, process.stdout, (line) => {
      bufferLine(line);
      // 2.32.x prints "...is runnning at http://..." (typo, three n's, URL on same line).
      // 2.36.x prints "...is running." (URL on a separate QSTASH_URL= line).
      if (!started && /runn+ing( at|\.)/i.test(line)) {
        clearTimeout(timeout);
        started = true;
        resolve(child);
      }
    });

    forwardWithPrefix(child.stderr, process.stderr, bufferLine);

    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(new Error(`[QStash Dev] Failed to start server: ${error.message}`));
    });

    // 'close' (not 'exit') waits for stdio to drain, so startupOutput captures the final line.
    child.on("close", (code: number | null, _signal: string | null) => {
      if (started) {
        onUnexpectedExit?.();
        return;
      }
      clearTimeout(timeout);
      reject(new Error(formatStartupError(code, startupOutput)));
    });
  });

  registerCleanup(child);

  // Don't keep the user's event loop alive solely because of the dev server —
  // a one-shot script (e.g. `node script.ts` that publishes once) should exit
  // when its own work is done. The exit/SIGINT handlers in registerCleanup
  // still kill the child cleanly when the parent does exit.
  child.unref?.();
  child.stdout?.unref?.();
  child.stderr?.unref?.();
};

const formatStartupError = (code: number | null, startupOutput: string): string => {
  // Strip ANSI color codes and the CLI's `9:47AM FTL ` timestamp/level prefix.
  const cleaned = startupOutput
    // eslint-disable-next-line no-control-regex
    .replaceAll(/\u001B\[[\d;]*m/g, "")
    .replaceAll(/^\d{1,2}:\d{2}(AM|PM)\s+\w{3}\s+/gm, "")
    .trim();

  if (/address already in use/i.test(cleaned)) {
    const match = /:(\d+)\s*$/.exec(cleaned);
    const portHint = match ? ` on port ${match[1]}` : "";
    return `[QStash Dev] Port already in use${portHint}. Set QSTASH_DEV_PORT to use a different port, or stop the process holding it.`;
  }

  const codeSuffix = code ? ` with code ${code}` : "";
  const detail = cleaned ? `: ${cleaned}` : "";
  return `[QStash Dev] Server exited unexpectedly${codeSuffix}${detail}`;
};

const forwardWithPrefix = (
  source: NodeJS.ReadableStream | null,
  destination: NodeJS.WritableStream,
  onLine: (line: string) => void
): void => {
  if (!source) return;
  let buffer = "";
  const flushLine = (line: string) => {
    destination.write(`${PREFIX} ${line}\n`);
    onLine(line);
  };
  source.on("data", (data: Buffer) => {
    buffer += data.toString();
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      flushLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
  });
  source.on("end", () => {
    if (buffer.length > 0) {
      flushLine(buffer);
      buffer = "";
    }
  });
  // Unhandled 'error' on an EventEmitter throws; a broken pipe to the child shouldn't crash us.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  source.on("error", () => {});
};

let currentChild: ChildProcess | undefined;
let processHandlersRegistered = false;

const killCurrentChild = () => {
  if (!currentChild) return;
  try {
    currentChild.kill("SIGTERM" as NodeJS.Signals);
  } catch {
    // Process may already be dead
  }
  currentChild = undefined;
};

/**
 * Kill the currently-running dev server child, if any. Exported for tests
 * so they can release the port between runs.
 */
export const stopCurrentServer = killCurrentChild;

const registerCleanup = (child: ChildProcess): void => {
  currentChild = child;

  if (!processHandlersRegistered) {
    processHandlersRegistered = true;
    process.on("exit", killCurrentChild);
    process.on("SIGINT", () => {
      killCurrentChild();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      killCurrentChild();
      process.exit(0);
    });
  }
};
