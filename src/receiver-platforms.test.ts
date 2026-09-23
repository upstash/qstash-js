import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  verifySignatureAppRouter,
  verifySignatureEdge,
  verifySignature,
} from "../platforms/nextjs";
import { verifySignatureH3 } from "../platforms/h3";
import { verifySignatureSvelte } from "../platforms/svelte";
import { verifySignatureSolidjs } from "../platforms/solidjs";
import { stubEnvironment } from "./client/test-utils";
import { QstashMissingCredentialsError } from "./client/error";
import { Receiver } from "./receiver";

const handler = () => Promise.resolve(new Response("ok"));
const platforms = [
  [
    "Next.js App Router",
    (config?: { devMode?: boolean }) => verifySignatureAppRouter(handler, config),
  ],
  ["Next.js Edge", (config?: { devMode?: boolean }) => verifySignatureEdge(handler, config)],
  ["Next.js Pages", (config?: { devMode?: boolean }) => verifySignature(handler, config)],
  ["H3", (config?: { devMode?: boolean }) => verifySignatureH3(handler, config)],
  ["Svelte", (config?: { devMode?: boolean }) => verifySignatureSvelte(handler, config)],
  ["Solid", (config?: { devMode?: boolean }) => verifySignatureSolidjs(handler, config)],
] as const;

describe.each(platforms)("%s missing signing keys", (_name, createHandler) => {
  let environment: Record<string, string | undefined>;
  let restore: () => void;

  beforeEach(() => {
    ({ environment, restore } = stubEnvironment([
      "NODE_ENV",
      "QSTASH_DEV",
      "QSTASH_REGION",
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
    ]));
    environment.NODE_ENV = "development";
  });

  afterEach(() => {
    restore();
  });

  test("suggests dev mode when credentials are missing in development", () => {
    expect(() => createHandler()).toThrow(QstashMissingCredentialsError);
    expect(() => createHandler()).toThrow(/QSTASH_DEV=true/);
  });

  test.each([undefined, "production"])("omits the dev hint when NODE_ENV is %s", (nodeEnv) => {
    environment.NODE_ENV = nodeEnv;
    try {
      createHandler();
      expect.unreachable("missing signing keys should throw");
    } catch (error) {
      expect((error as Error).message).toInclude("No signing keys available");
      expect((error as Error).message).not.toInclude("QSTASH_DEV=true");
    }
  });

  test("accepts dev signing keys without starting a server", () => {
    // Verifiers only select signing keys; they never start the local server.
    expect(() => createHandler({ devMode: true })).not.toThrow();
    environment.QSTASH_DEV = "true";
    expect(() => createHandler()).not.toThrow();
  });

  test("honors an explicit devMode false over the environment", () => {
    environment.QSTASH_DEV = "true";
    expect(() => createHandler({ devMode: false })).toThrow(/No signing keys available/);
  });
});

describe("Receiver missing signing keys", () => {
  let restore: () => void;

  beforeEach(() => {
    ({ restore } = stubEnvironment([
      "QSTASH_DEV",
      "QSTASH_REGION",
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
    ]));
  });

  afterEach(() => {
    restore();
  });

  test("throws a typed setup error", async () => {
    const receiver = new Receiver({ devMode: false });
    const verification = receiver.verify({ signature: "signature", body: "" });
    expect(verification).rejects.toBeInstanceOf(QstashMissingCredentialsError);
    expect(verification).rejects.toThrow(/No signing keys available/);
    await verification.catch(() => {
      // Asserted above.
    });
  });
});
