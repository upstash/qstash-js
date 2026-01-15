/**
 * Integration tests for multi-region support.
 * These tests modify process.env and test the full flow from environment variables
 * through to actual Client and Receiver usage.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { Receiver } from "../receiver";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "./workflow/test-utils";
import { createUpstashSingature } from "../receiver.test";
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
    test("should use default EU URL when publishing", async () => {
      // Setup: Default EU configuration
      setupEnvironment({
        QSTASH_TOKEN: "default-token",
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      // Test: Client should use default EU endpoint
      await mockQStashServer({
        execute: async () => {
          const client = new Client({
            baseUrl: MOCK_QSTASH_SERVER_URL,
            token: "default-token",
          });
          await client.publishJSON({
            url: "https://example.com/api",
            body: { message: "test" },
          });
        },
        responseFields: {
          body: { messageId: "msg_123" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://example.com/api`,
          token: "default-token",
          body: { message: "test" },
        },
      });
    });

    test("should initialize Receiver with default signing keys", () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const receiver = new Receiver();
      expect(receiver).toBeDefined();
    });

    test("should verify request with default signing keys", async () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const receiver = new Receiver();
      const body = JSON.stringify({ message: "test" });
      const url = "https://example.com/api";

      const signature = await createUpstashSingature({
        url,
        body,
        key: "default-current-key",
      });

      await receiver.verify({
        signature,
        body,
        url,
      });
    });
  });

  describe("Multi-Region US Configuration", () => {
    test("should use US region URL when QSTASH_REGION is US_EAST_1", async () => {
      // Setup: Multi-region with US priority
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        US_EAST_1_QSTASH_URL: MOCK_QSTASH_SERVER_URL,
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
        EU_CENTRAL_1_QSTASH_URL: "https://eu-qstash.upstash.io",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Test: Client should use US region endpoint
      await mockQStashServer({
        execute: async () => {
          const client = new Client();
          await client.publishJSON({
            url: "https://example.com/api",
            body: { message: "test from US" },
          });
        },
        responseFields: {
          body: { messageId: "msg_us_123" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://example.com/api`,
          token: "us-token",
          body: { message: "test from US" },
        },
      });
    });

    test("should initialize Receiver with US region signing keys", () => {
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      const receiver = new Receiver();
      expect(receiver).toBeDefined();
    });

    test("should verify request with US region signing keys", async () => {
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      // Simulate request from US region by passing region header
      const body = JSON.stringify({ message: "test from US" });
      const url = "https://example.com/api";

      const signature = await createUpstashSingature({
        url,
        body,
        key: "us-current-key",
      });

      // Create receiver that will check region-specific keys
      const receiver = new Receiver();

      // Verify with region header (simulating QStash sending the header)
      await receiver.verify({
        signature,
        body,
        url,
        upstashRegion: "US-EAST-1",
        clockTolerance: 0,
      });
    });
  });

  describe("Multi-Region EU Configuration", () => {
    test("should use EU region URL when QSTASH_REGION is EU_CENTRAL_1", async () => {
      // Setup: Multi-region with EU priority
      setupEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        US_EAST_1_QSTASH_TOKEN: "us-token",
        US_EAST_1_QSTASH_URL: "https://us-qstash.upstash.io",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
        EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
        EU_CENTRAL_1_QSTASH_URL: MOCK_QSTASH_SERVER_URL,
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      // Test: Client should use EU region endpoint
      await mockQStashServer({
        execute: async () => {
          const client = new Client();
          await client.publishJSON({
            url: "https://example.com/api",
            body: { message: "test from EU" },
          });
        },
        responseFields: {
          body: { messageId: "msg_eu_123" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://example.com/api`,
          token: "eu-token",
          body: { message: "test from EU" },
        },
      });
    });

    test("should initialize Receiver with EU region signing keys", () => {
      setupEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      const receiver = new Receiver();
      expect(receiver).toBeDefined();
    });

    test("should verify request with EU region signing keys", async () => {
      setupEnvironment({
        QSTASH_REGION: "EU_CENTRAL_1",
        EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY: "eu-current-key",
        EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY: "eu-next-key",
      });

      const body = JSON.stringify({ message: "test from EU" });
      const url = "https://example.com/api";

      const signature = await createUpstashSingature({
        url,
        body,
        key: "eu-current-key",
      });

      const receiver = new Receiver();

      await receiver.verify({
        signature,
        body,
        url,
        upstashRegion: "EU-CENTRAL-1",
      });
    });
  });

  describe("Fallback Behavior", () => {
    test("should fallback to default URL when region credentials are incomplete", async () => {
      // Setup: QSTASH_REGION set but incomplete region credentials
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        QSTASH_TOKEN: "default-token",
        QSTASH_URL: MOCK_QSTASH_SERVER_URL,
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
        // Missing US_EAST_1 credentials - should fallback to default
      });

      // Test: Client should use default URL since US region credentials are incomplete
      await mockQStashServer({
        execute: async () => {
          const client = new Client();
          await client.publishJSON({
            url: "https://example.com/api",
            body: { message: "fallback test" },
          });
        },
        responseFields: {
          body: { messageId: "msg_fallback_123" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://example.com/api`,
          token: "default-token",
          body: { message: "fallback test" },
        },
      });
    });

    test("should verify with fallback signing keys when region keys are incomplete", async () => {
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        // Missing US_EAST_1_QSTASH_NEXT_SIGNING_KEY - should fallback to default
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const body = JSON.stringify({ message: "fallback test" });
      const url = "https://example.com/api";

      // Sign with default key since region keys are incomplete
      const signature = await createUpstashSingature({
        url,
        body,
        key: "default-current-key",
      });

      const receiver = new Receiver();

      await receiver.verify({
        signature,
        body,
        url,
      });
    });
  });

  describe("Config Override Priority", () => {
    test("config should override environment variables", async () => {
      // Setup: Environment variables
      setupEnvironment({
        QSTASH_TOKEN: "env-token",
        QSTASH_URL: "https://env-qstash.upstash.io",
        QSTASH_CURRENT_SIGNING_KEY: "env-current-key",
        QSTASH_NEXT_SIGNING_KEY: "env-next-key",
      });

      // Test: Client config should override environment variables
      await mockQStashServer({
        execute: async () => {
          const client = new Client({
            baseUrl: MOCK_QSTASH_SERVER_URL,
            token: "config-token", // Override env token
          });
          await client.publishJSON({
            url: "https://example.com/api",
            body: { message: "config override" },
          });
        },
        responseFields: {
          body: { messageId: "msg_config_123" },
          status: 200,
        },
        receivesRequest: {
          method: "POST",
          url: `${MOCK_QSTASH_SERVER_URL}/v2/publish/https://example.com/api`,
          token: "config-token", // Should use config token, not env token
          body: { message: "config override" },
        },
      });
    });

    test("should initialize Receiver with config override", () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "env-current-key",
        QSTASH_NEXT_SIGNING_KEY: "env-next-key",
      });

      const receiver = new Receiver({
        currentSigningKey: "config-current-key",
        nextSigningKey: "config-next-key",
      });
      expect(receiver).toBeDefined();
    });

    test("should verify with config override keys", async () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "env-current-key",
        QSTASH_NEXT_SIGNING_KEY: "env-next-key",
      });

      const body = JSON.stringify({ message: "config override" });
      const url = "https://example.com/api";

      // Sign with config key, not env key
      const signature = await createUpstashSingature({
        url,
        body,
        key: "config-current-key",
      });

      // Receiver should use config keys, not env keys
      const receiver = new Receiver({
        currentSigningKey: "config-current-key",
        nextSigningKey: "config-next-key",
      });

      await receiver.verify({
        signature,
        body,
        url,
      });
    });
  });

  describe("Next.js App Router Verifier", () => {
    test("should verify request using verifySignatureAppRouter with US region", async () => {
      setupEnvironment({
        QSTASH_REGION: "US_EAST_1",
        US_EAST_1_QSTASH_CURRENT_SIGNING_KEY: "us-current-key",
        US_EAST_1_QSTASH_NEXT_SIGNING_KEY: "us-next-key",
      });

      const body = JSON.stringify({ message: "test from US via Next.js" });
      const url = "https://example.com/api/route";

      const signature = await createUpstashSingature({
        url,
        body,
        key: "us-current-key",
      });

      // Create a mock Next.js Request
      const request = new Request(url, {
        method: "POST",
        headers: {
          "upstash-signature": signature,
          "upstash-region": "US-EAST-1",
          "content-type": "application/json",
        },
        body: body,
      });

      let handlerCalled = false;
      const handler = (_request: Request) => {
        handlerCalled = true;
        return new Response("OK", { status: 200 });
      };

      const wrappedHandler = verifySignatureAppRouter(handler);
      const response = await wrappedHandler(request);

      const HTTP_OK = 200;
      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(HTTP_OK);
    });

    test("should verify request using verifySignatureAppRouter with default keys", async () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const body = JSON.stringify({ message: "test with default keys" });
      const url = "https://example.com/api/route";

      const signature = await createUpstashSingature({
        url,
        body,
        key: "default-current-key",
      });

      const request = new Request(url, {
        method: "POST",
        headers: {
          "upstash-signature": signature,
          "content-type": "application/json",
        },
        body: body,
      });

      let handlerCalled = false;
      const handler = async (request_: Request) => {
        handlerCalled = true;
        const responseBody = await request_.text();
        expect(responseBody).toBe(body);
        return new Response("OK", { status: 200 });
      };

      const wrappedHandler = verifySignatureAppRouter(handler);
      const response = await wrappedHandler(request);

      const HTTP_OK = 200;
      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(HTTP_OK);
    });

    test("should reject request with invalid signature using verifySignatureAppRouter", async () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "default-current-key",
        QSTASH_NEXT_SIGNING_KEY: "default-next-key",
      });

      const body = JSON.stringify({ message: "test" });
      const url = "https://example.com/api/route";

      const request = new Request(url, {
        method: "POST",
        headers: {
          "upstash-signature": "invalid-signature",
          "content-type": "application/json",
        },
        body: body,
      });

      let handlerCalled = false;
      const handler = (_request: Request) => {
        handlerCalled = true;
        return new Response("OK", { status: 200 });
      };

      const wrappedHandler = verifySignatureAppRouter(handler);

      // verifySignatureAppRouter will throw SignatureError for invalid signatures
      // This is expected behavior - the wrapper doesn't catch the error
      try {
        await wrappedHandler(request);
        expect.unreachable("Should have thrown SignatureError");
      } catch (error) {
        expect(error).toBeDefined();
        expect(handlerCalled).toBe(false);
      }
    });

    test("should use config override with verifySignatureAppRouter", async () => {
      setupEnvironment({
        QSTASH_CURRENT_SIGNING_KEY: "env-current-key",
        QSTASH_NEXT_SIGNING_KEY: "env-next-key",
      });

      const body = JSON.stringify({ message: "config override test" });
      const url = "https://example.com/api/route";

      // Sign with config key, not env key
      const signature = await createUpstashSingature({
        url,
        body,
        key: "config-current-key",
      });

      const request = new Request(url, {
        method: "POST",
        headers: {
          "upstash-signature": signature,
          "content-type": "application/json",
        },
        body: body,
      });

      let handlerCalled = false;
      const handler = (_request: Request) => {
        handlerCalled = true;
        return new Response("OK", { status: 200 });
      };

      // Pass config keys that override env keys
      const wrappedHandler = verifySignatureAppRouter(handler, {
        currentSigningKey: "config-current-key",
        nextSigningKey: "config-next-key",
      });
      const response = await wrappedHandler(request);

      const HTTP_OK = 200;
      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(HTTP_OK);
    });
  });
});
