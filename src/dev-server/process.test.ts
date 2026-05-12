import { describe, test, expect, afterEach, spyOn } from "bun:test";
import { spawnServer } from "./process";
import { writeFileSync, chmodSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DIM_PREFIX = "\u001B[2m[QStash CLI]\u001B[0m";

// eslint-disable-next-line unicorn/prevent-abbreviations
let temporaryDirectory: string;

const EXECUTABLE_MODE = 0o755;

const createFakeBinary = (script: string): string => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "qstash-test-"));
  const path = join(temporaryDirectory, "fake-qstash");
  writeFileSync(path, `#!/bin/bash\n${script}`);
  chmodSync(path, EXECUTABLE_MODE);
  return path;
};

describe("spawnServer", () => {
  afterEach(() => {
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test("rejects when process exits with code 0 before readiness", () => {
    const bin = createFakeBinary("exit 0");
    expect(spawnServer(bin, "9999")).rejects.toThrow("exited unexpectedly");
  });

  test("rejects when process is killed by signal before readiness", () => {
    const bin = createFakeBinary("kill -TERM $$");
    expect(spawnServer(bin, "9999")).rejects.toThrow("exited unexpectedly");
  });

  test("rejects when process exits with non-zero code", () => {
    const bin = createFakeBinary("echo 'something broke' >&2; exit 1");
    expect(spawnServer(bin, "9999")).rejects.toThrow("exited unexpectedly");
  });

  test("resolves when process prints readiness line", async () => {
    const bin = createFakeBinary('echo "running at http://localhost:$1"; sleep 30');
    await spawnServer(bin, "9999");
  });

  test("forwards child stdout to process.stdout with dim prefix", async () => {
    const writes: string[] = [];
    const spy = spyOn(process.stdout, "write").mockImplementation((chunk: Uint8Array | string) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    });

    try {
      const bin = createFakeBinary(
        'echo "hello world"; echo "running at http://localhost:$1"; sleep 30'
      );
      await spawnServer(bin, "9999");
    } finally {
      spy.mockRestore();
    }

    expect(writes).toContain(`${DIM_PREFIX} hello world\n`);
    // The first positional arg passed to the binary is "dev" (see spawnServer),
    // so $1 in the shell script is "dev", not the port.
    expect(writes).toContain(`${DIM_PREFIX} running at http://localhost:dev\n`);
  });

  test("does not keep parent event loop alive after readiness", async () => {
    // Verifies the spawned dev-server child doesn't pin the parent's event loop.
    // Without unref(), a script that does `await spawnServer(...)` and then ends
    // will hang forever — the original /dev route + asd.ts repro.
    const bin = createFakeBinary('echo "running at http://localhost:$1"; sleep 30');
    const helperPath = join(temporaryDirectory, "helper.ts");
    const processModulePath = join(import.meta.dir, "process.ts");
    writeFileSync(
      helperPath,
      `import { spawnServer } from ${JSON.stringify(processModulePath)};\n` +
        `await spawnServer(${JSON.stringify(bin)}, "9999");\n`
    );

    const helper = Bun.spawn(["bun", helperPath], { stdio: ["ignore", "pipe", "pipe"] });
    const HELPER_TIMEOUT_MS = 3000;
    const result = await Promise.race([
      helper.exited.then((code) => ({ kind: "exited" as const, code })),
      Bun.sleep(HELPER_TIMEOUT_MS).then(() => ({ kind: "timeout" as const })),
    ]);

    if (result.kind === "timeout") {
      helper.kill();
      await helper.exited;
      throw new Error("helper script hung — spawnServer kept the event loop alive");
    }
    expect(result.code).toBe(0);
  });

  test("forwards child stderr to process.stderr with dim prefix", async () => {
    const writes: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((chunk: Uint8Array | string) => {
      writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    });

    try {
      const bin = createFakeBinary(
        'echo "warn: something" >&2; echo "running at http://localhost:$1"; sleep 30'
      );
      await spawnServer(bin, "9999");
    } finally {
      spy.mockRestore();
    }

    expect(writes).toContain(`${DIM_PREFIX} warn: something\n`);
  });
});
