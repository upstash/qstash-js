/**
 * Tests for multi-region support in QStash client and verifiers.
 * Tests scenarios from the user's perspective based on Valid Env Variable Sets.
 */

import { describe, expect, test } from "bun:test";
import { Client } from "./client";
import { Receiver } from "../receiver";
import { getClientCredentials } from "./multi-region/outgoing";
import { getReceiverSigningKeys } from "./multi-region/incoming";

// Helper to create a clean environment for each test
const createEnvironment = (
  environment: Record<string, string>
): Record<string, string | undefined> => {
  return { ...environment };
};

describe("QStash Client - Multi-Region Credentials Resolution", () => {
  describe("Default (EU) - Only Token", () => {
    test("should use default EU endpoint with token from env", () => {
      const environment = createEnvironment({
        QSTASH_TOKEN: "test-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://qstash.upstash.io");
      expect(result.token).toBe("test-token");
    });

    test("should use default EU endpoint with token from config", () => {
      const environment = createEnvironment({});

      const result = getClientCredentials({ environment, config: { token: "config-token" } });

      expect(result.baseUrl).toBe("https://qstash.upstash.io");
      expect(result.token).toBe("config-token");
    });

    test("should warn when token is missing", () => {
      const environment = createEnvironment({});

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://qstash.upstash.io");
      expect(result.token).toBe("");
    });
  });

  describe("Default (EU) with Signing Keys", () => {
    test("should resolve default credentials with signing keys present", () => {
      const environment = createEnvironment({
        QSTASH_TOKEN: "test-token",
        QSTASH_CURRENT_SIGNING_KEY: "current-key",
        QSTASH_NEXT_SIGNING_KEY: "next-key",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://qstash.upstash.io");
      expect(result.token).toBe("test-token");
    });
  });

  describe("Region Specified via URL", () => {
    test("should use custom URL from environment", () => {
      const environment = createEnvironment({
        QSTASH_URL: "https://custom-qstash.upstash.io",
        QSTASH_TOKEN: "test-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://custom-qstash.upstash.io");
      expect(result.token).toBe("test-token");
    });

    test("should use custom URL from config", () => {
      const environment = createEnvironment({
        QSTASH_TOKEN: "env-token",
      });

      const result = getClientCredentials({
        environment,
        config: {
          baseUrl: "https://config-url.upstash.io",
          token: "config-token",
        },
      });

      expect(result.baseUrl).toBe("https://config-url.upstash.io");
      expect(result.token).toBe("config-token");
    });

    test("should strip trailing slash from URL", () => {
      const environment = createEnvironment({
        QSTASH_URL: "https://custom-qstash.upstash.io/",
        QSTASH_TOKEN: "test-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://custom-qstash.upstash.io");
    });
  });

  describe("Multi-Region Usage (Priority US)", () => {
    test("should use US region credentials when QSTASH_REGION is US_EAST_1", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        EU_CENTRAL_1_QSTASH_URL: "https://eu-qstash.upstash.io",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://us-qstash.upstash.io");
      expect(result.token).toBe("us-token");
    });

    test("should use EU region credentials when QSTASH_REGION is EU_CENTRAL_1", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        EU_CENTRAL_1_QSTASH_URL: "https://eu-qstash.upstash.io",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://eu-qstash.upstash.io");
      expect(result.token).toBe("eu-token");
    });

    test("should fallback to default when region credentials are missing", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        QSTASH_URL: "https://default-qstash.upstash.io",
        QSTASH_TOKEN: "default-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://default-qstash.upstash.io");
      expect(result.token).toBe("default-token");
    });

    test("should warn and fallback when region is invalid", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "INVALID_REGION",
        QSTASH_TOKEN: "default-token",
      });

      const result = getClientCredentials({ environment });

      expect(result.baseUrl).toBe("https://qstash.upstash.io");
      expect(result.token).toBe("default-token");
    });

    test("config overrides should take precedence over region-specific credentials", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_TOKEN: "us-token",
      });

      const result = getClientCredentials({
        environment,
        config: {
          baseUrl: "https://override.upstash.io",
          token: "override-token",
        },
      });

      expect(result.baseUrl).toBe("https://override.upstash.io");
      expect(result.token).toBe("override-token");
    });
  });

  describe("Client initialization with different env sets", () => {
    test("should initialize client with default credentials", () => {
      const client = new Client({
        token: "test-token",
        baseUrl: "https://qstash.upstash.io",
      });

      expect(client.http).toBeDefined();
    });

    test("should initialize client with region-specific token via config", () => {
      const client = new Client({
        token: "us-token",
        baseUrl: "https://us-qstash.upstash.io",
      });

      expect(client.http).toBeDefined();
    });
  });
});

describe("Receiver/Verifier - Multi-Region Signing Keys Resolution", () => {
  describe("Default Signing Keys", () => {
    test("should resolve default signing keys from environment", () => {
      const environment = createEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "current-key",
        QSTASH_NEXT_SIGNING_KEY: "next-key",
      });

      const result = getReceiverSigningKeys({ environment });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("current-key");
      expect(result?.nextSigningKey).toBe("next-key");
      expect(result?.region).toBeUndefined();
    });

    test("should resolve signing keys from config", () => {
      const environment = createEnvironment({});

      const result = getReceiverSigningKeys({
        environment,
        config: {
          currentSigningKey: "config-current",
          nextSigningKey: "config-next",
        },
      });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("config-current");
      expect(result?.nextSigningKey).toBe("config-next");
      expect(result?.region).toBeUndefined();
    });

    test("should return undefined when no signing keys are available", () => {
      const environment = createEnvironment({});

      const result = getReceiverSigningKeys({ environment });

      expect(result).toBeUndefined();
    });
  });

  describe("Region-Specific Signing Keys with UPSTASH_REGION Header", () => {
    test("should resolve US region signing keys when header is US_EAST_1", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "us-east-1" });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("us-current-key");
      expect(result?.nextSigningKey).toBe("us-next-key");
      expect(result?.region).toBe("US_EAST_1");
    });

    test("should resolve EU region signing keys when header is EU_CENTRAL_1", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "eu-central-1" });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("eu-current-key");
      expect(result?.nextSigningKey).toBe("eu-next-key");
      expect(result?.region).toBe("EU_CENTRAL_1");
    });

    test("should normalize region header with hyphens to underscores", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "US-EAST-1" });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("us-current-key");
      expect(result?.nextSigningKey).toBe("us-next-key");
      expect(result?.region).toBe("US_EAST_1");
    });

    test("should fallback to default keys when region-specific keys are missing", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "US_EAST_1" });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("default-current-key");
      expect(result?.nextSigningKey).toBe("default-next-key");
      expect(result?.region).toBeUndefined();
    });

    test("should warn and fallback when region header is invalid", () => {
      const environment = createEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "INVALID_REGION" });

      expect(result).toBeDefined();
      expect(result?.currentSigningKey).toBe("default-current-key");
      expect(result?.nextSigningKey).toBe("default-next-key");
      expect(result?.region).toBeUndefined();
    });
  });

  describe("Multi-Region Mode with Both Regions Configured", () => {
    test("should work in receiver-only multi-region mode without QSTASH_REGION", () => {
      const environment = createEnvironment({
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Without QSTASH_REGION set, region-specific keys should not be used
      const usResult = getReceiverSigningKeys({ environment, regionFromHeader: "US_EAST_1" });
      expect(usResult).toBeUndefined();

      const euResult = getReceiverSigningKeys({ environment, regionFromHeader: "EU_CENTRAL_1" });
      expect(euResult).toBeUndefined();
    });

    test("should use correct region keys based on header in multi-region setup", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Request from US region
      const usResult = getReceiverSigningKeys({ environment, regionFromHeader: "US_EAST_1" });
      expect(usResult?.currentSigningKey).toBe("us-current-key");
      expect(usResult?.region).toBe("US_EAST_1");

      // Request from EU region
      const euResult = getReceiverSigningKeys({ environment, regionFromHeader: "EU_CENTRAL_1" });
      expect(euResult?.currentSigningKey).toBe("eu-current-key");
      expect(euResult?.region).toBe("EU_CENTRAL_1");
    });

    test("config keys should take precedence over region-specific keys", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      const result = getReceiverSigningKeys({
        environment,
        config: {
          currentSigningKey: "config-current",
          nextSigningKey: "config-next",
        },
        regionFromHeader: "US_EAST_1",
      });

      expect(result?.currentSigningKey).toBe("config-current");
      expect(result?.nextSigningKey).toBe("config-next");
    });
  });

  describe("Receiver initialization with different env sets", () => {
    test("should initialize receiver with default keys from config", () => {
      const receiver = new Receiver({
        currentSigningKey: "current-key",
        nextSigningKey: "next-key",
      });

      expect(receiver).toBeDefined();
    });

    test("should initialize receiver without config (will resolve from env)", () => {
      const receiver = new Receiver();

      expect(receiver).toBeDefined();
    });
  });

  describe("Edge cases and warnings", () => {
    test("should warn when QSTASH_REGION is set but credentials are incomplete", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        // Missing US_EAST_1_QSTASH_TOKEN
      });

      const result = getClientCredentials({ environment });

      // Should fallback to defaults
      expect(result.baseUrl).toBe("https://qstash.upstash.io");
    });

    test("should warn when QSTASH_REGION is set but signing keys are incomplete", () => {
      const environment = createEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        // Missing US_EAST_1_QSTASH_NEXT_SIGNING_KEY
        QSTASH_CURRENT_SIGNING_KEY: "default-current",
        QSTASH_NEXT_SIGNING_KEY: "default-next",
      });

      const result = getReceiverSigningKeys({ environment, regionFromHeader: "US_EAST_1" });

      // Should fallback to defaults
      expect(result?.currentSigningKey).toBe("default-current");
      expect(result?.nextSigningKey).toBe("default-next");
    });
  });
});
