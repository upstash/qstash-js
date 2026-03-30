/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */

import { importChildProcess } from "./constants";

export type ChildProcess = {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  pid?: number;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
};

export const spawnServer = async (binaryPath: string, port: string): Promise<ChildProcess> => {
  const childProcess = await importChildProcess();
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = childProcess.spawn(binaryPath, ["dev", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("[QStash Dev] Server failed to start within 30 seconds"));
    }, 30_000);

    let stderrOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      if (/runn+ing at/i.test(output)) {
        clearTimeout(timeout);
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
};

export const registerCleanup = (child: ChildProcess): void => {
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
