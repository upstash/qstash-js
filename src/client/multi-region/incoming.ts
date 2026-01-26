import type { QStashRegion } from "./utils";
import {
  getRegionFromEnvironment,
  normalizeRegionHeader,
  readReceiverEnvironmentVariables,
} from "./utils";

type SigningKeys = {
  currentSigningKey?: string;
  nextSigningKey?: string;
};

type ReceiverCredentialConfig = {
  environment: Record<string, string | undefined>;
  regionFromHeader?: string;
  config?: SigningKeys;
};

type CredentialsWithRegion = Required<SigningKeys> & {
  region?: QStashRegion;
};

/**
 * Resolve signing keys for incoming request verification.
 * Handles all logic for inferring keys from config and environment variables.
 *
 * Priority order:
 * 1. Keys passed in config (currentSigningKey, nextSigningKey)
 * 2. Region-specific keys based on upstashRegion header (e.g., US_EAST_1_QSTASH_CURRENT_SIGNING_KEY)
 * 3. Default keys (QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY)
 *
 * @param config - Optional signing keys from config
 * @param regionFromHeader - The UPSTASH_REGION header value from the request
 * @returns Resolved signing keys
 * @throws Error if no valid signing keys can be found
 */
export const getReceiverSigningKeys = ({
  environment,
  regionFromHeader,
  config,
}: ReceiverCredentialConfig): CredentialsWithRegion | undefined => {
  // 1. Check for config overrides
  if (config?.currentSigningKey && config.nextSigningKey) {
    return {
      currentSigningKey: config.currentSigningKey,
      nextSigningKey: config.nextSigningKey,
    };
  }

  // 2. Check for region-specific credentials if QSTASH_REGION is set
  const regionEnvironment = getRegionFromEnvironment(environment);
  if (regionEnvironment) {
    const regionHeader = normalizeRegionHeader(regionFromHeader);

    if (regionHeader) {
      const regionCreds = readReceiverEnvironmentVariables(environment, regionHeader);

      if (regionCreds.QSTASH_CURRENT_SIGNING_KEY && regionCreds.QSTASH_NEXT_SIGNING_KEY) {
        return {
          currentSigningKey: regionCreds.QSTASH_CURRENT_SIGNING_KEY,
          nextSigningKey: regionCreds.QSTASH_NEXT_SIGNING_KEY,
          region: regionHeader,
        };
      } else {
        console.warn(
          `[Upstash QStash] Signing keys not found for region "${regionHeader}". Falling back to default signing keys.`
        );
      }
    } else {
      console.warn(
        `[Upstash QStash] Invalid UPSTASH_REGION header value: "${regionFromHeader}". Expected one of: EU-CENTRAL-1, US-EAST-1. Falling back to default signing keys.`
      );
    }
  }

  // 3. Use default credentials
  const defaultCreds = readReceiverEnvironmentVariables(environment);
  if (defaultCreds.QSTASH_CURRENT_SIGNING_KEY && defaultCreds.QSTASH_NEXT_SIGNING_KEY) {
    return {
      currentSigningKey: defaultCreds.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: defaultCreds.QSTASH_NEXT_SIGNING_KEY,
    };
  }
};
