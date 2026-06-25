/* eslint-disable no-console */
import {
  ARTIFACTS_LIST_URL,
  BINARY_URL_BASE,
  DEV_PREFIX,
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
  const os = await importOs();
  const cacheDirectory = await findCacheDirectory();
  const isWindows = os.platform() === "win32";
  const binaryName = isWindows ? "qstash.exe" : "qstash";
  const binaryPath = `${cacheDirectory}/${binaryName}`;
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
      console.log(`${DEV_PREFIX} Offline, using local v${cachedVersion}`);
      return binaryPath;
    }
    throw error;
  }

  return downloadBinary(version, cacheDirectory);
};

const fetchLatestVersion = async (): Promise<string> => {
  const { ok, statusCode, body } = await nativeGet(ARTIFACTS_LIST_URL);

  if (!ok) {
    throw new Error(`[QStash Dev] Failed to fetch latest version: HTTP ${statusCode}`);
  }

  // Parse <CommonPrefixes><Prefix>qstash/versions/X.Y.Z/</Prefix></CommonPrefixes>
  const xml = body.toString();
  const versions: string[] = [];
  const re = /<Prefix>qstash\/versions\/([^/<]+)\/<\/Prefix>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const v = match[1];
    // Skip pre-releases (e.g. 2.20.7-rc.1). Only stable X.Y.Z.
    if (/^\d+\.\d+\.\d+$/.test(v)) versions.push(v);
  }

  if (versions.length === 0) {
    throw new Error("[QStash Dev] No stable versions found in artifact bucket");
  }

  versions.sort(compareSemver);
  const latest = versions.at(-1);
  if (!latest) {
    throw new Error("[QStash Dev] No stable versions found in artifact bucket");
  }
  return latest;
};

const compareSemver = (a: string, b: string): number => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (const [index, part] of pa.entries()) {
    if (part !== pb[index]) return part - pb[index];
  }
  return 0;
};

const findCacheDirectory = async (): Promise<string> => {
  const fs = await importFs();
  const os = await importOs();

  const home = os.homedir();
  const platform = os.platform();

  // Use OS-standard cache directories so the binary is shared across projects.
  let base: string;
  if (platform === "darwin") {
    base = `${home}/Library/Caches/upstash`;
  } else if (platform === "win32") {
    base = `${process.env.LOCALAPPDATA ?? `${home}/AppData/Local`}/upstash`;
  } else {
    base = `${home}/.cache/upstash`;
  }
  const cacheDirectory = `${base}/qstash-dev`;

  await fs.promises.mkdir(cacheDirectory, { recursive: true });
  return cacheDirectory;
};

const downloadBinary = async (version: string, cacheDirectory: string): Promise<string> => {
  const fs = await importFs();
  const childProcess = await importChildProcess();
  const os = await importOs();

  const osPlatform = os.platform();
  const isWindows = osPlatform === "win32";
  const platform = isWindows ? "windows" : osPlatform === "darwin" ? "darwin" : "linux";
  const arch = os.arch() === "arm64" ? "arm64" : "amd64";

  const archiveName = `qstash-server_${version}_${platform}_${arch}`;
  const binaryName = isWindows ? "qstash.exe" : "qstash";
  const binaryPath = `${cacheDirectory}/${binaryName}`;
  const versionFile = `${cacheDirectory}/.version`;

  // Check if cached binary is already the right version
  if (fs.existsSync(binaryPath) && fs.existsSync(versionFile)) {
    const cachedVersion = fs.readFileSync(versionFile, "utf8").trim();
    if (cachedVersion === version) {
      return binaryPath;
    }
  }

  // Wipe the cache dir so stale files (old binary, version file, leftover archives)
  // can't mix with the new version on extraction failure.
  await fs.promises.rm(cacheDirectory, { recursive: true, force: true });
  await fs.promises.mkdir(cacheDirectory, { recursive: true });

  const extension = isWindows ? "zip" : "tar.gz";
  const archiveUrl = `${BINARY_URL_BASE}/${version}/${archiveName}.${extension}`;
  console.log(`${DEV_PREFIX} Downloading dev server v${version}...`);

  const { ok, statusCode, body } = await nativeGet(archiveUrl);
  if (!ok) {
    throw new Error(`[QStash Dev] Failed to download binary: HTTP ${statusCode}`);
  }

  const archivePath = `${cacheDirectory}/${archiveName}.${extension}`;
  await fs.promises.writeFile(archivePath, new Uint8Array(body));

  childProcess.execFileSync("tar", ["-xf", archivePath, "-C", cacheDirectory], {
    stdio: "pipe",
  });

  if (!isWindows) {
    const EXECUTABLE_PERMISSION = 0o755;
    await fs.promises.chmod(binaryPath, EXECUTABLE_PERMISSION);
  }

  await fs.promises.writeFile(versionFile, version);

  // Unlink deletes the file if it's not a link
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await fs.promises.unlink(archivePath).catch(() => {});

  return binaryPath;
};
