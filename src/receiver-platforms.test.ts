import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  verifySignatureAppRouter,
  verifySignatureEdge,
  verifySignature,
} from "../platforms/nextjs";
import { verifySignatureH3 } from "../platforms/h3";
import { verifySignatureSvelte } from "../platforms/svelte";
import { verifySignatureSolidjs } from "../platforms/solidjs";

const handler = () => Promise.resolve(new Response("ok"));
type Config = { devMode?: boolean };
const platforms = [
  ["Next.js App Router", (config?: Config) => verifySignatureAppRouter(handler, config)],
  ["Next.js Edge", (config?: Config) => verifySignatureEdge(handler, config)],
  ["Next.js Pages", (config?: Config) => verifySignature(handler, config)],
  ["H3", (config?: Config) => verifySignatureH3(handler, config)],
  ["Svelte", (config?: Config) => verifySignatureSvelte(handler, config)],
  ["Solid", (config?: Config) => verifySignatureSolidjs(handler, config)],
] as const;

const MANAGED_KEYS = [
  "QSTASH_DEV",
  "QSTASH_REGION",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
];

describe.each(platforms)("%s signing keys", (_name, createHandler) => {
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

  test("throws when signing keys are missing", () => {
    expect(() => createHandler()).toThrow(/currentSigningKey and nextSigningKey are required/);
  });

  test("accepts dev mode without signing keys", () => {
    expect(() => createHandler({ devMode: true })).not.toThrow();
    environment.QSTASH_DEV = "true";
    expect(() => createHandler()).not.toThrow();
  });

  test("honors an explicit devMode false over QSTASH_DEV", () => {
    environment.QSTASH_DEV = "true";
    expect(() => createHandler({ devMode: false })).toThrow();
  });
});
