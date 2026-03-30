import { importChildProcess } from "./constants";

const STARTUP_TIMEOUT_MS = 30_000;

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

    child.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      if (/runn+ing at/i.test(output)) {
        clearTimeout(timeout);
        started = true;
        resolve(child);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
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
      if (code !== null && code !== 0) {
        reject(
          new Error(
            `[QStash Dev] Server exited with code ${code}${stderrOutput ? `: ${stderrOutput}` : ""}`
          )
        );
      }
    });
  });

  registerCleanup(child);
};

const registerCleanup = (child: ChildProcess): void => {
  const cleanup = () => {
    try {
      child.kill("SIGTERM" as NodeJS.Signals);
    } catch {
      // Process may already be dead
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
};
