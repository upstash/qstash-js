/**
 * Integration tests for multi-region support.
 * These tests modify process.env and test the full flow from environment variables
 * through to actual Client and Receiver usage.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { getClientCredentials } from "./multi-region/outgoing";
import { getReceiverSigningKeys } from "./multi-region/incoming";
import { verifySignatureAppRouter } from "../../platforms/nextjs";

// Store original environment to restore after each test
let originalEnvironment: Record<string, string | undefined> = {};

/**
 * Helper to set up environment variables for a test
 */
function setupEnvironment(environmentVariables: Record<string, string>) {
  // Clear relevant env vars
  const keysToManage = [
    "QSTASH_TOKEN",
    "QSTASH_URL",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "QSTASH_REGION",
    "US_EAST_1_QSTASH_TOKEN",
    "US_EAST_1_QSTASH_URL",
    "US_EAST_1_QSTASH_CURRENT_SIGNING_KEY",
    "US_EAST_1_QSTASH_NEXT_SIGNING_KEY",
    "EU_CENTRAL_1_QSTASH_TOKEN",
    "EU_CENTRAL_1_QSTASH_URL",
    "EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY",
    "EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY",
  ];

  for (const key of keysToManage) {
    if (key in environmentVariables) {
      process.env[key] = environmentVariables[key];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[key];
    }
  }
}

/**
 * Helper to restore environment variables after a test
 */
function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("Multi-Region Integration Tests", () => {
  beforeEach(() => {
    // Save current environment
    originalEnvironment = {
      QSTASH_TOKEN: process.env.QSTASH_TOKEN,
      QSTASH_URL: process.env.QSTASH_URL,
      QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
      QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
      QSTASH_REGION: process.env.QSTASH_REGION,
      US_EAST_1_QSTASH_TOKEN: process.env.US_EAST_1_QSTASH_TOKEN,
      US_EAST_1_QSTASH_URL: process.env.US_EAST_1_QSTASH_URL,
      US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: process.env.US_EAST_1_QSTASH_CURRENT_SIGNING_KEY,
      US_EAST_1_QSTASH_NEXT_SIGNING_KEY: process.env.US_EAST_1_QSTASH_NEXT_SIGNING_KEY,
      EU_CENTRAL_1_QSTASH_TOKEN: process.env.EU_CENTRAL_1_QSTASH_TOKEN,
      EU_CENTRAL_1_QSTASH_URL: process.env.EU_CENTRAL_1_QSTASH_URL,
      EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: process.env.EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY,
      EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: process.env.EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY,
    };
  });

  afterEach(() => {
    restoreEnvironment();
  });

  describe("Default (EU) Configuration", () => {
    test("should use default credentials and signing keys from env", () => {
      // Setup: Default EU configuration
      setupEnvironment({
        QSTASH_TOKEN: "default-token",
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      // Test 1: resolveCredentials
      const credentials = getClientCredentials({
        environment: process.env as Record<string, string | undefined>,
      });
      expect(credentials.baseUrl).toBe("https://qstash.upstash.io");
      expect(credentials.token).toBe("default-token");

      // Test 2: resolveSigningKeys
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
      });
      expect(signingKeys).toBeDefined();
      expect(signingKeys?.currentSigningKey).toBe("default-current-key");
      expect(signingKeys?.nextSigningKey).toBe("default-next-key");

      // Test 3: Client initialization
      const client = new Client({
        baseUrl: "https://qstash.upstash.io",
        token: "default-token",
      });
      expect(client).toBeDefined();

      // Test 4: verifySignatureAppRouter
      const handler = verifySignatureAppRouter(
        async (request: Request) => {
          const body = await request.json();
          return new Response(JSON.stringify({ received: body }), { status: 200 });
        },
        {
          currentSigningKey: "default-current-key",
          nextSigningKey: "default-next-key",
        }
      );

      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });
  });

  describe("Multi-Region US Configuration", () => {
    test("should use US region credentials when QSTASH_REGION is US_EAST_1", () => {
      // Setup: Multi-region with US priority
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
        EU_CENTRAL_1_QSTASH_URL: "https://eu-qstash.upstash.io",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Test 1: resolveCredentials should use US region
      const credentials = getClientCredentials({
        environment: process.env as Record<string, string | undefined>,
      });
      expect(credentials.baseUrl).toBe("https://us-qstash.upstash.io");
      expect(credentials.token).toBe("us-token");

      // Test 2: resolveSigningKeys with US region header
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "US_EAST_1",
      });
      expect(signingKeys).toBeDefined();
      expect(signingKeys?.currentSigningKey).toBe("us-current-key");
      expect(signingKeys?.nextSigningKey).toBe("us-next-key");
      expect(signingKeys?.region).toBe("US_EAST_1");

      // Test 3: Client initialization
      const client = new Client({
        baseUrl: "https://us-qstash.upstash.io",
        token: "us-token",
      });
      expect(client).toBeDefined();

      // Test 4: verifySignatureAppRouter with US region header
      const handler = verifySignatureAppRouter(
        async (request: Request) => {
          const body = await request.json();
          return new Response(JSON.stringify({ received: body, region: "US" }), { status: 200 });
        },
        {
          currentSigningKey: "us-current-key",
          nextSigningKey: "us-next-key",
        }
      );

      expect(handler).toBeDefined();
    });
  });

  describe("Multi-Region EU Configuration", () => {
    test("should use EU region credentials when QSTASH_REGION is EU_CENTRAL_1", () => {
      // Setup: Multi-region with EU priority
      setupEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
        EU_CENTRAL_1_QSTASH_URL: "https://eu-qstash.upstash.io",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Test 1: resolveCredentials should use EU region
      const credentials = getClientCredentials({
        environment: process.env as Record<string, string | undefined>,
      });
      expect(credentials.baseUrl).toBe("https://eu-qstash.upstash.io");
      expect(credentials.token).toBe("eu-token");

      // Test 2: resolveSigningKeys with EU region header
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "EU_CENTRAL_1",
      });
      expect(signingKeys).toBeDefined();
      expect(signingKeys?.currentSigningKey).toBe("eu-current-key");
      expect(signingKeys?.nextSigningKey).toBe("eu-next-key");
      expect(signingKeys?.region).toBe("EU_CENTRAL_1");

      // Test 3: Client initialization
      const client = new Client({
        baseUrl: "https://eu-qstash.upstash.io",
        token: "eu-token",
      });
      expect(client).toBeDefined();

      // Test 4: verifySignatureAppRouter
      const handler = verifySignatureAppRouter(
        async (request: Request) => {
          const body = await request.json();
          return new Response(JSON.stringify({ received: body, region: "EU" }), { status: 200 });
        },
        {
          currentSigningKey: "eu-current-key",
          nextSigningKey: "eu-next-key",
        }
      );

      expect(handler).toBeDefined();
    });
  });

  describe("Multi-Region with Header Normalization", () => {
    test("should normalize region header with hyphens to underscores", () => {
      // Setup: Multi-region configuration
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      // Test: resolveSigningKeys with hyphenated region header (as sent by QStash)
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "US-EAST-1",
      });
      expect(signingKeys).toBeDefined();
      expect(signingKeys?.currentSigningKey).toBe("us-current-key");
      expect(signingKeys?.nextSigningKey).toBe("us-next-key");
      expect(signingKeys?.region).toBe("US_EAST_1");
    });
  });

  describe("Multi-Region without QSTASH_REGION - receiver only", () => {
    test("should work in receiver-only multi-region mode", () => {
      // Setup: Only region-specific signing keys, no QSTASH_REGION
      setupEnvironment({
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Test 1: resolveSigningKeys with US region header
      const usKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "US_EAST_1",
      });
      expect(usKeys).toBeUndefined();

      // Test 2: resolveSigningKeys with EU region header
      const euKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "EU_CENTRAL_1",
      });
      expect(euKeys).toBeUndefined();
    });
  });

  describe("Fallback Behavior", () => {
    test("should fallback to default credentials when region credentials are incomplete", () => {
      // Setup: QSTASH_REGION set but incomplete region credentials
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        QSTASH_TOKEN: "default-token",
        QSTASH_URL: "https://default-qstash.upstash.io",
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
        // Missing US_EAST_1 credentials
      });

      // Test 1: resolveCredentials should fallback
      const credentials = getClientCredentials({
        environment: process.env as Record<string, string | undefined>,
      });
      expect(credentials.baseUrl).toBe("https://default-qstash.upstash.io");
      expect(credentials.token).toBe("default-token");

      // Test 2: resolveSigningKeys should fallback
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        regionFromHeader: "US_EAST_1",
      });
      expect(signingKeys).toBeDefined();
      expect(signingKeys?.currentSigningKey).toBe("default-current-key");

      // Test 3: Client should work with fallback credentials
      const client = new Client({
        baseUrl: "https://default-qstash.upstash.io",
        token: "default-token",
      });
      expect(client).toBeDefined();
    });
  });

  describe("Config Override Priority", () => {
    test("config should override environment variables", () => {
      // Setup: Environment variables
      setupEnvironment({
        QSTASH_TOKEN: "env-token",
        QSTASH_URL: "https://env-qstash.upstash.io",
        QSTASH_CURRENT_SIGNING_KEY: "env-current-key",
        QSTASH_NEXT_SIGNING_KEY: "env-next-key",
      });

      // Test 1: resolveCredentials with config override
      const credentials = getClientCredentials({
        environment: process.env as Record<string, string | undefined>,
        config: {
          baseUrl: "https://config-qstash.upstash.io",
          token: "config-token",
        },
      });
      expect(credentials.baseUrl).toBe("https://config-qstash.upstash.io");
      expect(credentials.token).toBe("config-token");

      // Test 2: resolveSigningKeys with config override
      const signingKeys = getReceiverSigningKeys({
        environment: process.env as Record<string, string | undefined>,
        config: {
          currentSigningKey: "config-current-key",
          nextSigningKey: "config-next-key",
        },
      });
      expect(signingKeys?.currentSigningKey).toBe("config-current-key");
      expect(signingKeys?.nextSigningKey).toBe("config-next-key");

      // Test 3: Client with config override
      const client = new Client({
        baseUrl: "https://config-qstash.upstash.io",
        token: "config-token", // Override env token
      });
      expect(client).toBeDefined();
    });
  });
});
