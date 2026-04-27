import { importChildProcess } from "./constants";

const STARTUP_TIMEOUT_MS = 30_000;
const PREFIX = "\u001B[2m[QStash CLI]\u001B[0m";

type ChildProcess = {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  pid?: number;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
};

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

    let stderrOutput = "";
    let started = false;

    forwardWithPrefix(child.stdout, process.stdout, (line) => {
      if (!started && /runn+ing at/i.test(line)) {
        clearTimeout(timeout);
        started = true;
        resolve(child);
      }
    });

    forwardWithPrefix(child.stderr, process.stderr, (line) => {
      stderrOutput += `${line}\n`;
    });

    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(new Error(`[QStash Dev] Failed to start server: ${error.message}`));
    });

    child.on("exit", (code: number | null, _signal: string | null) => {
      if (started && onUnexpectedExit) {
        onUnexpectedExit();
        return;
      }
      clearTimeout(timeout);
      reject(
        new Error(
          `[QStash Dev] Server exited unexpectedly${code ? ` with code ${code}` : ""}${stderrOutput ? `: ${stderrOutput}` : ""}`
        )
      );
    });
  });

  registerCleanup(child);
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
