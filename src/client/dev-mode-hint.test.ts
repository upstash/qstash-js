import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "./client";
import { processOptions } from "./workflow/serve";
import { Receiver } from "../receiver";
import { verifySignatureAppRouter } from "../../platforms/nextjs";

const MANAGED_KEYS = [
  "NODE_ENV",
  "QSTASH_DEV",
  "QSTASH_TOKEN",
  "QSTASH_REGION",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
];
const HINT = /QSTASH_DEV=true/;

const captureWarnings = (run: () => void): string[] => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...arguments_: unknown[]) => warnings.push(arguments_.map(String).join(" "));
  try {
    run();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
};

describe("dev mode hint on missing credentials", () => {
  const environment = process.env as Record<string, string | undefined>;
  let original: Record<string, string | undefined>;

  beforeEach(() => {
    original = Object.fromEntries(MANAGED_KEYS.map((key) => [key, environment[key]]));
    for (const key of MANAGED_KEYS) Reflect.deleteProperty(environment, key);
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      if (original[key] === undefined) Reflect.deleteProperty(environment, key);
      else environment[key] = original[key];
    }
  });

  test.each([undefined, "development"])(
    "client warning has the hint when NODE_ENV is %s",
    (nodeEnvironment) => {
      if (nodeEnvironment) environment.NODE_ENV = nodeEnvironment;
      const warnings = captureWarnings(() => new Client());
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toInclude("client token is not set");
      expect(warnings[0]).toMatch(HINT);
    }
  );

  test("client warning has no hint in production", () => {
    environment.NODE_ENV = "production";
    const warnings = captureWarnings(() => new Client());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toMatch(HINT);
  });

  test("Receiver error has the hint", async () => {
    const receiver = new Receiver({ devMode: false });
    const error = await receiver
      .verify({ signature: "signature", body: "" })
      .catch((error: unknown) => error);
    expect((error as Error).message).toMatch(HINT);
  });

  test("verifySignature error has the hint", () => {
    expect(() => verifySignatureAppRouter(() => new Response("ok"))).toThrow(HINT);
  });

  test("workflow serve does not build a client when one is passed", () => {
    const qstashClient = new Client({ token: "token" });
    const warnings = captureWarnings(() => processOptions({ qstashClient }));
    expect(warnings).toHaveLength(0);
  });
});
