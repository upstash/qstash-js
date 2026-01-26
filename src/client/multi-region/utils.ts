export type QStashRegion = "EU_CENTRAL_1" | "US_EAST_1";

const VALID_REGIONS = ["EU_CENTRAL_1", "US_EAST_1"] as const;

export const DEFAULT_QSTASH_URL = "https://qstash.upstash.io";

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
