import { describe, test, expect, beforeAll } from "bun:test";
import { ensureBinary } from "./binary";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { homedir, platform } from "node:os";

const CACHE_DIR =
  platform() === "darwin"
    ? `${homedir()}/Library/Caches/upstash/qstash-dev`
    : `${homedir()}/.cache/upstash/qstash-dev`;

describe("ensureBinary", () => {
  beforeAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test(
    "downloads a working binary",
    async () => {
      const binaryPath = await ensureBinary();

      // Binary should exist and be executable
      const output = execFileSync(binaryPath, ["--help"], { encoding: "utf8" });
      expect(output).toContain("qstash");
    },
    { timeout: 60_000 }
  );
});
