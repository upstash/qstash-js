/* eslint-disable unicorn/prevent-abbreviations */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-console */

import {
  DEFAULT_DEV_PORT,
  LOCK_EXPIRY_MS,
  BINARY_URL_BASE,
  GITHUB_RELEASES_URL,
  importFs,
  importChildProcess,
  importOs,
} from "./constants";
import type { NodeFs } from "./constants";
import { getNativeGet } from "./health";

export const fetchLatestVersion = async (): Promise<string> => {
  const nativeGet = await getNativeGet();
  const { statusCode, body } = await nativeGet(GITHUB_RELEASES_URL, {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "upstash-qstash-js",
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`[QStash Dev] Failed to fetch latest version: HTTP ${statusCode}`);
  }

  const data = JSON.parse(body.toString()) as { tag_name: string };
  return data.tag_name.replace(/^v/, "");
};

export const findCacheDirectory = async (): Promise<string> => {
  const fs = await importFs();
  const os = await importOs();

  const home = os.homedir();
  const platform = os.platform();

  // Use OS-standard cache directories so the binary is shared across projects.
  const base = platform === "darwin" ? `${home}/Library/Caches/upstash` : `${home}/.cache/upstash`;
  const cacheDir = `${base}/qstash-dev`;

  await fs.promises.mkdir(cacheDir, { recursive: true });
  return cacheDir;
};

export const acquireLock = async (
  lockPath: string,
  fs: typeof NodeFs
): Promise<(() => Promise<void>) | undefined> => {
  try {
    const stat = await fs.promises.stat(lockPath).catch(() => {});
    if (stat) {
      const age = Date.now() - stat.mtimeMs;
      if (age < LOCK_EXPIRY_MS) {
        // Another process is actively downloading
        return undefined;
      }
      // Stale lock — remove it
      await fs.promises.unlink(lockPath).catch(() => {});
    }
    await fs.promises.writeFile(lockPath, `${process.pid}`, { flag: "wx" });
    return async () => {
      await fs.promises.unlink(lockPath).catch(() => {});
    };
  } catch {
    // Lock file was created by another process between our check and write
    return undefined;
  }
};

export const waitForLock = async (
  lockPath: string,
  fs: typeof NodeFs,
  expiryMs: number = LOCK_EXPIRY_MS
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < expiryMs) {
    const exists = fs.existsSync(lockPath);
    if (!exists) return;
    await new Promise((r) => setTimeout(r, 200));
  }
};

export const downloadBinary = async (version: string, cacheDir: string): Promise<string> => {
  const fs = await importFs();
  const childProcess = await importChildProcess();
  const os = await importOs();

  const osPlatform = os.platform();
  if (osPlatform === "win32") {
    throw new Error(
      "[QStash Dev] Windows is not supported. " +
        "Please use WSL or start the dev server manually:\n\n" +
        `  npx @upstash/qstash-cli dev --port ${DEFAULT_DEV_PORT}\n`
    );
  }

  const platform = osPlatform === "darwin" ? "darwin" : "linux";
  const arch = os.arch() === "arm64" ? "arm64" : "amd64";

  const tarballName = `qstash-server_${version}_${platform}_${arch}`;
  const binaryPath = `${cacheDir}/qstash`;
  const versionFile = `${cacheDir}/.version`;
  const lockPath = `${cacheDir}/.download.lock`;

  // Check if cached binary is already the right version
  if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
    const cachedVersion = fs.readFileSync(versionFile, "utf8").trim();
    if (cachedVersion === version) {
      return binaryPath;
    }
  }

  // Acquire a lock to prevent concurrent downloads across processes
  const releaseLock = await acquireLock(lockPath, fs);
  if (!releaseLock) {
    // Another process is downloading — wait for it to finish
    await waitForLock(lockPath, fs);
    // After waiting, the binary should be available
    if (fs.existsSync(binaryPath)) {
      return binaryPath;
    }
    throw new Error("[QStash Dev] Another process was downloading the binary but it failed");
  }

  try {
    // Re-check after acquiring lock (another process may have finished between our check and lock)
    if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
      const cachedVersion = fs.readFileSync(versionFile, "utf8").trim();
      if (cachedVersion === version) {
        return binaryPath;
      }
      fs.unlinkSync(binaryPath);
    }

    const tarballUrl = `${BINARY_URL_BASE}/${version}/${tarballName}.tar.gz`;
    console.log(`[QStash Dev] Downloading dev server v${version}...`);

    const nativeGet = await getNativeGet();
    const { statusCode, body } = await nativeGet(tarballUrl);
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`[QStash Dev] Failed to download binary: HTTP ${statusCode}`);
    }

    const tarballPath = `${cacheDir}/${tarballName}.tar.gz`;
    await fs.promises.writeFile(tarballPath, new Uint8Array(body));

    childProcess.execFileSync("tar", ["-xzf", tarballPath, "-C", cacheDir], { stdio: "pipe" });

    await fs.promises.chmod(binaryPath, 0o755);

    await fs.promises.writeFile(versionFile, version);
    await fs.promises.unlink(tarballPath).catch(() => {});

    return binaryPath;
  } finally {
    await releaseLock();
  }
};
