export type QStashRegion = "EU_CENTRAL_1" | "US_EAST_1";

const VALID_REGIONS = ["EU_CENTRAL_1", "US_EAST_1"] as const;

export const DEFAULT_QSTASH_URL = "https://qstash.upstash.io";

export const MISSING_TOKEN_MESSAGE =
  "[Upstash QStash] client token is not set. Either pass a token or set QSTASH_TOKEN env variable.";

export const MISSING_SIGNING_KEYS_MESSAGE =
  "[Upstash QStash] No signing keys available for verification. Either pass currentSigningKey and nextSigningKey, or set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env variables.";

const DEV_MODE_HINT =
  "You can also develop without credentials: set QSTASH_DEV=true (or pass devMode: true) to run QStash locally. " +
  "See https://upstash.com/docs/qstash/howto/local-development";

/**
 * Whether we are outside production, in which case suggesting the local dev
 * server makes sense.
 *
 * An unset NODE_ENV counts as development: plain node/bun scripts often don't
 * set it, and dev mode is a no-op in production anyway.
 */
export const isDevelopmentEnvironment = (
  environment: Record<string, string | undefined>
): boolean => (environment.NODE_ENV ?? "") !== "production";

/**
 * Appends the "you can use dev mode" hint to a missing-credentials message
 * when we're not running in production.
 */
export const withDevModeHint = (
  message: string,
  environment: Record<string, string | undefined>
): string => (isDevelopmentEnvironment(environment) ? `${message}\n${DEV_MODE_HINT}` : message);

export const getRegionFromEnvironment = (
  environment: Record<string, string | undefined>
): QStashRegion | undefined => {
  const region = environment.QSTASH_REGION as QStashRegion | undefined;
  return normalizeRegionHeader(region);
};

function readEnvironmentVariables<T extends readonly string[]>(
  environmentVariables: T,
  environment: Record<string, string | undefined>,
  region?: QStashRegion
): Record<T[number], string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (const variable of environmentVariables) {
    const key = region ? `${region}_${variable}` : variable;
    result[variable] = environment[key];
  }

  return result as Record<T[number], string | undefined>;
}

export function readClientEnvironmentVariables(
  environment: Record<string, string | undefined>,
  region?: QStashRegion
) {
  return readEnvironmentVariables(["QSTASH_URL", "QSTASH_TOKEN"] as const, environment, region);
}

export function readReceiverEnvironmentVariables(
  environment: Record<string, string | undefined>,
  region?: QStashRegion
) {
  return readEnvironmentVariables(
    ["QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY"] as const,
    environment,
    region
  );
}

export function normalizeRegionHeader(region: string | undefined): QStashRegion | undefined {
  if (!region) {
    return undefined;
  }

  region = region.replaceAll("-", "_").toUpperCase();
  if (VALID_REGIONS.includes(region as QStashRegion)) {
    return region as QStashRegion;
  }

  console.warn(
    `[Upstash QStash] Invalid UPSTASH_REGION header value: "${region}". Expected one of: ${VALID_REGIONS.join(
      ", "
    )}.`
  );

  return undefined;
}
