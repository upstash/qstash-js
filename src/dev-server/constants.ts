/* eslint-disable @typescript-eslint/no-magic-numbers */
export const DEFAULT_DEV_PORT = 8642;
export const LOCK_EXPIRY_MS = 60_000; // Lock files older than this are considered stale

// These are public, deterministic dev-only credentials baked into the QStash dev
// server binary. They are NOT secrets and are safe to ship in the npm package.
export const DEV_QSTASH_TOKEN =
  "eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=";
export const DEV_QSTASH_CURRENT_SIGNING_KEY = "sig_7kYjw48mhY7kAjqNGcy6cr29RJ6r";
export const DEV_QSTASH_NEXT_SIGNING_KEY = "sig_5ZB6DVzB1wjE8S6rZ7eenA8Pdnhs";

export const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/upstash/qstash-cli/releases/latest";
export const BINARY_URL_BASE = "https://artifacts.upstash.com/qstash/versions";
export const CONSOLE_URL = "https://console.upstash.com/qstash/local-mode-user";

export type DevelopmentCredentials = {
  token: string;
  currentSigningKey: string;
  nextSigningKey: string;
  baseUrl: string;
};

export type Runtime = "nodejs" | "edge" | "cloudflare-workers" | "browser";

// All Node.js built-in imports use template literal concatenation so that
// edge bundlers (Next.js, Vercel, Cloudflare) cannot statically resolve them.
// These imports are only reached in Node.js runtimes.

import type * as NodeHttp from "node:http";
import type * as NodeHttps from "node:https";
import type * as NodeFs from "node:fs";
import type * as NodeChildProcess from "node:child_process";
import type * as NodeOs from "node:os";

// Dynamic imports use a helper to prevent edge bundlers from statically resolving them.
const _n = (m: string) => `node:${m}`;
export const importHttp = (): Promise<typeof NodeHttp> =>
  import(/* webpackIgnore: true */ _n("http"));
export const importHttps = (): Promise<typeof NodeHttps> =>
  import(/* webpackIgnore: true */ _n("https"));
export const importFs = (): Promise<typeof NodeFs> => import(/* webpackIgnore: true */ _n("fs"));
export const importChildProcess = (): Promise<typeof NodeChildProcess> =>
  import(/* webpackIgnore: true */ _n("child_process"));
export const importOs = (): Promise<typeof NodeOs> => import(/* webpackIgnore: true */ _n("os"));

export * as NodeHttp from "node:http";
export * as NodeHttps from "node:https";
export * as NodeFs from "node:fs";
export * as NodeChildProcess from "node:child_process";
export * as NodeOs from "node:os";
