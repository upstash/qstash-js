import { describe, test, expect, afterEach } from "bun:test";
import { spawnServer } from "./process";
import { writeFileSync, chmodSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
});
