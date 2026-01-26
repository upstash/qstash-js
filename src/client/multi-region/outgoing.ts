import type { QStashRegion } from "./utils";
import {
  DEFAULT_QSTASH_URL,
  getRegionFromEnvironment,
  readClientEnvironmentVariables,
} from "./utils";

type Credentials = {
  baseUrl?: string;
  token?: string;
};

type ClientCredentialConfig = {
  environment: Record<string, string | undefined>;
  config?: Credentials;
};

type CredentialsWithRegion = Required<Credentials> & {
  region?: QStashRegion;
};

/**
 * Resolve QStash credentials for outgoing requests.
 * Handles all logic for inferring credentials from config and environment variables.
 *
 * Priority order:
 * 1. Config overrides (baseUrl and token from config)
 * 2. Region-specific credentials based on QSTASH_REGION (e.g., US_EAST_1_QSTASH_URL)
 * 3. Default credentials (QSTASH_URL, QSTASH_TOKEN)
 * 4. Default URL with token from environment
 *
 * @param config - Optional credentials from config
 * @returns Resolved credentials
 */
export const getClientCredentials = (
  clientCredentialConfig: ClientCredentialConfig
): Required<Credentials> => {
  const credentials = resolveCredentials(clientCredentialConfig);
  return verifyCredentials(credentials);
};

const resolveCredentials = ({
  environment,
  config,
}: ClientCredentialConfig): CredentialsWithRegion => {
  // 1. Check for config overrides
  if (config?.baseUrl && config.token) {
    return {
      baseUrl: config.baseUrl,
      token: config.token,
    };
  }

  // 2. Check for region-specific credentials if QSTASH_REGION is set
  const region = getRegionFromEnvironment(environment);
  if (region) {
    const regionCreds = readClientEnvironmentVariables(environment, region);

    if (regionCreds.QSTASH_URL && regionCreds.QSTASH_TOKEN) {
      return {
        baseUrl: regionCreds.QSTASH_URL,
        token: regionCreds.QSTASH_TOKEN,
        region,
      };
    } else {
      console.warn(
        `[Upstash QStash] QSTASH_REGION is set to "${region}" but credentials are missing. Expected ${region}_QSTASH_URL and ${region}_QSTASH_TOKEN. Falling back to default credentials.`
      );
    }
  }

  // 3. Use default credentials
  const defaultCreds = readClientEnvironmentVariables(environment);
  return {
    baseUrl: config?.baseUrl ?? defaultCreds.QSTASH_URL ?? DEFAULT_QSTASH_URL,
    token: config?.token ?? defaultCreds.QSTASH_TOKEN ?? "",
  };
};

const verifyCredentials = (credentials: Required<Credentials>): Required<Credentials> => {
  const token = credentials.token;
  let baseUrl = credentials.baseUrl;

  // Clean up baseUrl
  baseUrl = baseUrl.replace(/\/$/, "");

  // fixes https://github.com/upstash/qstash-js/issues/226
  if (baseUrl === "https://qstash.upstash.io/v2/publish") {
    baseUrl = DEFAULT_QSTASH_URL;
  }

  // Warn if token is still missing
  if (!token) {
    console.warn(
      "[Upstash QStash] client token is not set. Either pass a token or set QSTASH_TOKEN env variable."
    );
  }
  return { baseUrl, token };
};
