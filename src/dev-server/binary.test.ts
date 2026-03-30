/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { acquireLock, waitForLock } from "./binary";

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qstash-binary-test-"));
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("acquireLock", () => {
  test("acquires lock when no lock file exists", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    const release = await acquireLock(lockPath, fs);

    expect(release).toBeDefined();
    expect(fs.existsSync(lockPath)).toBe(true);

    await release!();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test("returns undefined when fresh lock exists", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    fs.writeFileSync(lockPath, "12345");

    const release = await acquireLock(lockPath, fs);
    expect(release).toBeUndefined();
  });

  test("acquires lock when stale lock exists", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    fs.writeFileSync(lockPath, "12345");
    const pastTime = Date.now() - 120_000;
    fs.utimesSync(lockPath, new Date(pastTime), new Date(pastTime));

    const release = await acquireLock(lockPath, fs);
    expect(release).toBeDefined();

    await release!();
  });

  test("release function removes the lock file", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    const release = await acquireLock(lockPath, fs);
    expect(release).toBeDefined();

    expect(fs.existsSync(lockPath)).toBe(true);
    await release!();
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});

describe("waitForLock", () => {
  test("returns immediately when no lock file exists", async () => {
    const lockPath = path.join(temporaryDirectory, ".nonexistent.lock");
    const start = Date.now();
    await waitForLock(lockPath, fs, 5000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  test("returns when lock file is removed", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    fs.writeFileSync(lockPath, "12345");

    setTimeout(() => {
      fs.unlinkSync(lockPath);
    }, 300);

    const start = Date.now();
    await waitForLock(lockPath, fs, 5000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(elapsed).toBeLessThan(2000);
  });

  test("times out when lock file persists", async () => {
    const lockPath = path.join(temporaryDirectory, ".download.lock");
    fs.writeFileSync(lockPath, "12345");

    const start = Date.now();
    await waitForLock(lockPath, fs, 500);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(400);
  });
});
