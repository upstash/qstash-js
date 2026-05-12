import { describe, test, expect, beforeAll } from "bun:test";
import { ensureBinary } from "./binary";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const getCacheDirectory = () => {
  const p = platform();
  if (p === "darwin") return `${homedir()}/Library/Caches/upstash/qstash-dev`;
  if (p === "win32")
    return `${process.env.LOCALAPPDATA ?? `${homedir()}/AppData/Local`}/upstash/qstash-dev`;
  return `${homedir()}/.cache/upstash/qstash-dev`;
};

const CACHE_DIR = getCacheDirectory();

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

  test(
    "wipes cache directory when cached version is stale",
    async () => {
      // Prior test already populated the cache with the latest version.
      // Plant a stale file and fake the version so the download path runs
      // and we can assert that the stale file was wiped.
      const stalePath = join(CACHE_DIR, "stale.txt");
      writeFileSync(stalePath, "leftover from an older run");
      writeFileSync(join(CACHE_DIR, ".version"), "0.0.0-stale");
      expect(existsSync(stalePath)).toBe(true);

      await ensureBinary();

      expect(existsSync(stalePath)).toBe(false);
    },
    { timeout: 60_000 }
  );
});
