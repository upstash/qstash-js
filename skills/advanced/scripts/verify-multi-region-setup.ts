#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */

/**
 * Script to verify QStash environment variable setup
 *
 * This script checks:
 * - Whether the setup is single-region or multi-region
 * - Which region will be used for outgoing messages
 * - Whether all required environment variables are present
 *
 * Usage:
 *   npx tsx skills/advanced/scripts/verify-multi-region-setup.ts
 *   # or with node
 *   node skills/advanced/scripts/verify-multi-region-setup.js
 *
 * To load from .env file, install dotenv first:
 *   npm install dotenv
 *   npx tsx -r dotenv/config skills/advanced/scripts/verify-multi-region-setup.ts
 */

// // Try to load dotenv if available
try {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports, unicorn/prefer-module
  require("dotenv").config();
} catch {
  // dotenv not available, will use process.env directly
}

type QStashRegion = "EU_CENTRAL_1" | "US_EAST_1";

const VALID_REGIONS = ["EU_CENTRAL_1", "US_EAST_1"] as const;
const DEFAULT_QSTASH_URL = "https://qstash.upstash.io";

type CheckResult = {
  status: "success" | "warning" | "error";
  message: string;
};

type VerificationResult = {
  mode: "single-region" | "multi-region";
  primaryRegion?: QStashRegion;
  checks: CheckResult[];
  outgoingConfig: {
    url?: string;
    token?: string;
    source: string;
  };
  incomingConfig: {
    currentKey?: string;
    nextKey?: string;
    source: string;
  };
};

// Colors for terminal output
const colors = {
  reset: "\u001B[0m",
  bright: "\u001B[1m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  cyan: "\u001B[36m",
};

function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text: string): void {
  console.log("\n" + colorize("bright", colorize("cyan", text)));
  console.log(colorize("cyan", "=".repeat(text.length)));
}

function printCheck(result: CheckResult): void {
  const icon = result.status === "success" ? "✓" : result.status === "warning" ? "⚠" : "✗";
  const color =
    result.status === "success" ? "green" : result.status === "warning" ? "yellow" : "red";
  console.log(`${colorize(color, icon)} ${result.message}`);
}

function normalizeRegion(region: string | undefined): QStashRegion | undefined {
  if (!region) return undefined;

  const normalized = region.replaceAll("-", "_").toUpperCase();
  if (VALID_REGIONS.includes(normalized as QStashRegion)) {
    return normalized as QStashRegion;
  }

  return undefined;
}

function checkEnvironmentVariable(name: string, required = false): CheckResult {
  const value = process.env[name];

  if (!value) {
    return {
      status: required ? "error" : "warning",
      message: `${name} is ${required ? "required but " : ""}not set`,
    };
  }

  const maskedValue = value.length > 10 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "***";
  return {
    status: "success",
    message: `${name} = ${maskedValue}`,
  };
}

function verifySetup(): VerificationResult {
  const checks: CheckResult[] = [];
  const qstashRegion = process.env.QSTASH_REGION;
  const normalizedRegion = normalizeRegion(qstashRegion);

  // Determine mode
  const mode = normalizedRegion ? "multi-region" : "single-region";
  const primaryRegion = normalizedRegion;

  printHeader("QStash Environment Verification");

  // Check mode
  if (mode === "multi-region" && primaryRegion) {
    console.log(colorize("bright", `\nMode: `) + colorize("green", "Multi-Region"));
    console.log(colorize("bright", `Primary Region: `) + colorize("green", primaryRegion));
  } else {
    console.log(colorize("bright", `\nMode: `) + colorize("blue", "Single-Region (Default)"));
    if (qstashRegion && !normalizedRegion) {
      checks.push({
        status: "error",
        message: `Invalid QSTASH_REGION="${qstashRegion}". Valid values: ${VALID_REGIONS.join(", ")}`,
      });
    }
  }

  let outgoingUrl: string | undefined;
  let outgoingToken: string | undefined;
  let outgoingSource: string;

  if (mode === "multi-region" && primaryRegion) {
    // Multi-region mode
    const regionUrl = process.env[`${primaryRegion}_QSTASH_URL`];
    const regionToken = process.env[`${primaryRegion}_QSTASH_TOKEN`];

    if (regionUrl && regionToken) {
      outgoingUrl = regionUrl;
      outgoingToken = regionToken;
      outgoingSource = `${primaryRegion}_QSTASH_*`;

      checks.push(
        {
          status: "success",
          message: `Using ${primaryRegion} credentials`,
        },
        checkEnvironmentVariable(`${primaryRegion}_QSTASH_URL`, true),
        checkEnvironmentVariable(`${primaryRegion}_QSTASH_TOKEN`, true)
      );
    } else {
      // In multi-region mode, missing region-specific credentials is an error
      checks.push({
        status: "error",
        message: `${primaryRegion} credentials required in multi-region mode`,
      });

      if (!regionUrl) {
        checks.push(checkEnvironmentVariable(`${primaryRegion}_QSTASH_URL`, true));
      }
      if (!regionToken) {
        checks.push(checkEnvironmentVariable(`${primaryRegion}_QSTASH_TOKEN`, true));
      }

      // Still set fallback values for summary display
      outgoingUrl = process.env.QSTASH_URL ?? DEFAULT_QSTASH_URL;
      outgoingToken = process.env.QSTASH_TOKEN;
      outgoingSource = "QSTASH_* (fallback - ERROR)";
    }
  } else {
    // Single-region mode
    outgoingUrl = process.env.QSTASH_URL ?? DEFAULT_QSTASH_URL;
    outgoingToken = process.env.QSTASH_TOKEN;
    outgoingSource = "QSTASH_*";

    checks.push(
      checkEnvironmentVariable("QSTASH_URL", false),
      checkEnvironmentVariable("QSTASH_TOKEN", true)
    );
  }

  let currentKey: string | undefined;
  let nextKey: string | undefined;
  let incomingSource: string;

  if (mode === "multi-region" && primaryRegion) {
    // In multi-region mode, check for region-specific keys
    const usCurrentKey = process.env.US_EAST_1_QSTASH_CURRENT_SIGNING_KEY;
    const usNextKey = process.env.US_EAST_1_QSTASH_NEXT_SIGNING_KEY;
    const euCurrentKey = process.env.EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY;
    const euNextKey = process.env.EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY;

    const hasUsKeys = usCurrentKey && usNextKey;
    const hasEuKeys = euCurrentKey && euNextKey;

    if (hasUsKeys && hasEuKeys) {
      checks.push(
        {
          status: "success",
          message: "Region-specific signing keys configured for both US and EU",
        },
        checkEnvironmentVariable("US_EAST_1_QSTASH_CURRENT_SIGNING_KEY", false),
        checkEnvironmentVariable("US_EAST_1_QSTASH_NEXT_SIGNING_KEY", false),
        checkEnvironmentVariable("EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY", false),
        checkEnvironmentVariable("EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY", false)
      );

      currentKey = primaryRegion === "US_EAST_1" ? usCurrentKey : euCurrentKey;
      nextKey = primaryRegion === "US_EAST_1" ? usNextKey : euNextKey;
      incomingSource = "Region-specific keys";
    } else if (hasUsKeys) {
      checks.push(
        {
          status: "warning",
          message: "Only US region signing keys configured",
        },
        checkEnvironmentVariable("US_EAST_1_QSTASH_CURRENT_SIGNING_KEY", false),
        checkEnvironmentVariable("US_EAST_1_QSTASH_NEXT_SIGNING_KEY", false),
        {
          status: "warning",
          message: "EU signing keys not configured - EU messages will attempt to use keys",
        }
      );

      currentKey = usCurrentKey;
      nextKey = usNextKey;
      incomingSource = "US-specific keys";
    } else if (hasEuKeys) {
      checks.push(
        {
          status: "warning",
          message: "Only EU region signing keys configured",
        },
        checkEnvironmentVariable("EU_CENTRAL_1_QSTASH_CURRENT_SIGNING_KEY", false),
        checkEnvironmentVariable("EU_CENTRAL_1_QSTASH_NEXT_SIGNING_KEY", false),
        {
          status: "warning",
          message: "US signing keys not configured - US messages will attempt to use default keys",
        }
      );

      currentKey = euCurrentKey;
      nextKey = euNextKey;
      incomingSource = "EU-specific keys";
    } else {
      checks.push({
        status: "warning",
        message: "No region-specific signing keys found, using default keys",
      });

      currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
      nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
      incomingSource = "QSTASH_* (default)";

      checks.push(
        checkEnvironmentVariable("QSTASH_CURRENT_SIGNING_KEY", false),
        checkEnvironmentVariable("QSTASH_NEXT_SIGNING_KEY", false)
      );
    }
  } else {
    // Single-region mode
    currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    incomingSource = "QSTASH_*";

    checks.push(
      checkEnvironmentVariable("QSTASH_CURRENT_SIGNING_KEY", false),
      checkEnvironmentVariable("QSTASH_NEXT_SIGNING_KEY", false)
    );

    if (!currentKey && !nextKey) {
      checks.push({
        status: "warning",
        message:
          "Signing keys not set - incoming message verification will fail if verifier is used",
      });
    }
  }

  return {
    mode,
    primaryRegion,
    checks,
    outgoingConfig: {
      url: outgoingUrl,
      token: outgoingToken,
      source: outgoingSource,
    },
    incomingConfig: {
      currentKey,
      nextKey,
      source: incomingSource,
    },
  };
}

function printSummary(result: VerificationResult): void {
  console.log(colorize("bright", "\nOutgoing Messages:"));
  console.log(`  URL: ${result.outgoingConfig.url ?? "not set"}`);
  console.log(`  Token: ${result.outgoingConfig.token ? "✓ configured" : "✗ not set"}`);
  console.log(`  Source: ${result.outgoingConfig.source}`);

  console.log(colorize("bright", "\nIncoming Messages:"));
  console.log(`  Current Key: ${result.incomingConfig.currentKey ? "✓ configured" : "✗ not set"}`);
  console.log(`  Next Key: ${result.incomingConfig.nextKey ? "✓ configured" : "✗ not set"}`);
  console.log(`  Source: ${result.incomingConfig.source}`);

  printHeader("Verification Results");

  const errors = result.checks.filter((c) => c.status === "error");
  const warnings = result.checks.filter((c) => c.status === "warning");
  const successes = result.checks.filter((c) => c.status === "success");

  for (const element of result.checks) {
    printCheck(element);
  }

  console.log(
    `\n${colorize("bright", "Summary:")} ${colorize("green", `${successes.length} passed`)}, ${colorize("yellow", `${warnings.length} warnings`)}, ${colorize("red", `${errors.length} errors`)}`
  );

  if (errors.length > 0) {
    console.log(
      colorize("red", "\n✗ Configuration has errors. Please fix them before using QStash.")
    );
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(
      colorize("yellow", "\n⚠ Configuration has warnings. Review them to ensure proper setup.")
    );
  } else {
    console.log(colorize("green", "\n✓ Configuration looks good!"));
  }

  // Provide recommendations
  if (result.mode === "multi-region") {
    printHeader("Multi-Region Recommendations");

    console.log("For optimal multi-region operation:");
    console.log("1. Configure region-specific signing keys for both US and EU");
    console.log("2. Always pass the 'upstashRegion' parameter in receiver.verify()");
    console.log("3. Monitor SDK warnings in your application logs");
    console.log("4. Test message delivery from both regions");

    console.log(colorize("cyan", "\nExample verification code:"));
    console.log(`
  await receiver.verify({
    signature: request.headers.get("upstash-signature")!,
    body: await request.text(),
    upstashRegion: request.headers.get("upstash-region") ?? undefined,
  });
    `);
  } else {
    printHeader("Recommendations");

    if (!result.incomingConfig.currentKey || !result.incomingConfig.nextKey) {
      console.log("Consider adding signing keys for incoming message verification:");
      console.log("  QSTASH_CURRENT_SIGNING_KEY=your_current_key");
      console.log("  QSTASH_NEXT_SIGNING_KEY=your_next_key");
      console.log("\nGet keys from: https://console.upstash.com/qstash");
    }

    if (!process.env.QSTASH_URL) {
      console.log("\nUsing default EU region. To specify a custom URL:");
      console.log("  QSTASH_URL=https://qstash.upstash.io");
    }
  }
  console.log("  Multi-Region: skills/advanced/multi-region.md");
  console.log("  Verification: skills/verification/receiver.md");
  console.log("");
}

// Main execution
try {
  const result = verifySetup();
  printSummary(result);
} catch (error) {
  console.error(colorize("red", "\nError running verification:"), error);
  process.exit(1);
}
