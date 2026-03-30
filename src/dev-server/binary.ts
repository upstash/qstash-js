/* eslint-disable no-console */
import {
  BINARY_URL_BASE,
  GITHUB_RELEASES_URL,
  importFs,
  importChildProcess,
  importOs,
} from "./constants";
import { nativeGet } from "./http";

/**
 * Resolve the version (with network fallback to cached), then download if needed.
 * Returns the path to the ready-to-run binary.
 */
export const ensureBinary = async (): Promise<string> => {
  const fs = await importFs();
  const cacheDirectory = await findCacheDirectory();
  const binaryPath = `${cacheDirectory}/qstash`;
  const versionFile = `${cacheDirectory}/.version`;

  let version: string;
  try {
    version = await fetchLatestVersion();
  } catch (error) {
    // Network failed — if we have a cached binary, use it
    if (fs.existsSync(binaryPath)) {
      const cachedVersion = fs.existsSync(versionFile)
        ? fs.readFileSync(versionFile, "utf8").trim()
        : "unknown";
      console.log(`[QStash Dev] Offline, using local v${cachedVersion}`);
      return binaryPath;
    }
    throw error;
  }

  return downloadBinary(version, cacheDirectory);
};

const fetchLatestVersion = async (): Promise<string> => {
  const { ok, statusCode, body } = await nativeGet(GITHUB_RELEASES_URL, {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "upstash-qstash-js",
  });

  if (!ok) {
    throw new Error(`[QStash Dev] Failed to fetch latest version: HTTP ${statusCode}`);
  }

  const data = JSON.parse(body.toString()) as { tag_name: string };
  return data.tag_name.replace(/^v/, "");
};

const findCacheDirectory = async (): Promise<string> => {
  const fs = await importFs();
  const os = await importOs();

  const home = os.homedir();
  const platform = os.platform();

  // Use OS-standard cache directories so the binary is shared across projects.
  const base = platform === "darwin" ? `${home}/Library/Caches/upstash` : `${home}/.cache/upstash`;
  const cacheDirectory = `${base}/qstash-dev`;

  await fs.promises.mkdir(cacheDirectory, { recursive: true });
  return cacheDirectory;
};

const downloadBinary = async (version: string, cacheDirectory: string): Promise<string> => {
  const fs = await importFs();
  const childProcess = await importChildProcess();
  const os = await importOs();

  const osPlatform = os.platform();
  if (osPlatform === "win32") {
    throw new Error(
      "[QStash Dev] The local dev server is not supported on Windows.\n" +
        "Use a local tunnel instead: https://upstash.com/docs/workflow/howto/local-development/local-tunnel\n"
    );
  }

  const platform = osPlatform === "darwin" ? "darwin" : "linux";
  const arch = os.arch() === "arm64" ? "arm64" : "amd64";

  const tarballName = `qstash-server_${version}_${platform}_${arch}`;
  const binaryPath = `${cacheDirectory}/qstash`;
  const versionFile = `${cacheDirectory}/.version`;

  // Check if cached binary is already the right version
  if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
    const cachedVersion = fs.readFileSync(versionFile, "utf8").trim();
    if (cachedVersion === version) {
      return binaryPath;
    }
  }

  const tarballUrl = `${BINARY_URL_BASE}/${version}/${tarballName}.tar.gz`;
  console.log(`[QStash Dev] Downloading dev server v${version}...`);

  const { ok, statusCode, body } = await nativeGet(tarballUrl);
  if (!ok) {
    throw new Error(`[QStash Dev] Failed to download binary: HTTP ${statusCode}`);
  }

  const tarballPath = `${cacheDirectory}/${tarballName}.tar.gz`;
  await fs.promises.writeFile(tarballPath, new Uint8Array(body));

  childProcess.execFileSync("tar", ["-xzf", tarballPath, "-C", cacheDirectory], { stdio: "pipe" });

  const EXECUTABLE_PERMISSION = 0o755;
  await fs.promises.chmod(binaryPath, EXECUTABLE_PERMISSION);

  await fs.promises.writeFile(versionFile, version);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await fs.promises.unlink(tarballPath).catch(() => {});

  return binaryPath;
};
