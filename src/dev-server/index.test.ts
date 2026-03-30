import { describe, test, expect } from "bun:test";
import {
  shouldUseDevelopmentMode,
  getDevelopmentCredentials,
  getDevUrl as getDevelopmentUrl,
  getRuntime,
} from "./index";
import {
  DEV_QSTASH_TOKEN,
  DEV_QSTASH_CURRENT_SIGNING_KEY,
  DEV_QSTASH_NEXT_SIGNING_KEY,
} from "./constants";

describe("shouldUseDevelopmentMode", () => {
  test("returns true when devMode is true", () => {
    expect(shouldUseDevelopmentMode(true)).toBe(true);
  });

  test("returns false when devMode is false", () => {
    expect(shouldUseDevelopmentMode(false)).toBe(false);
  });

  test("returns false when devMode is false even if env says true", () => {
    expect(shouldUseDevelopmentMode(false, { QSTASH_DEV: "true" })).toBe(false);
  });

  test("returns true when devMode is true even if env says false", () => {
    expect(shouldUseDevelopmentMode(true, { QSTASH_DEV: "false" })).toBe(true);
  });

  test("returns true when env QSTASH_DEV is 'true'", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "true" })).toBe(true);
  });

  test("returns true when env QSTASH_DEV is '1'", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "1" })).toBe(true);
  });

  test("returns true when env QSTASH_DEV is empty string", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "" })).toBe(true);
  });

  test("returns false when env QSTASH_DEV is 'false'", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "false" })).toBe(false);
  });

  test("returns false when env QSTASH_DEV is '0'", () => {
    expect(shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "0" })).toBe(false);
  });

  test("returns false when env QSTASH_DEV is undefined", () => {
    expect(shouldUseDevelopmentMode(undefined, {})).toBe(false);
  });

  test("throws on invalid QSTASH_DEV value", () => {
    expect(() => shouldUseDevelopmentMode(undefined, { QSTASH_DEV: "maybe" })).toThrow(
      "Invalid value for QSTASH_DEV"
    );
  });
});

describe("getDevUrl", () => {
  test("returns default URL when no port set", () => {
    expect(getDevelopmentUrl({})).toBe("http://127.0.0.1:8642");
  });

  test("uses QSTASH_DEV_PORT from env", () => {
    expect(getDevelopmentUrl({ QSTASH_DEV_PORT: "9999" })).toBe("http://127.0.0.1:9999");
  });

  test("ignores invalid port", () => {
    expect(getDevelopmentUrl({ QSTASH_DEV_PORT: "not-a-number" })).toBe("http://127.0.0.1:8642");
  });

  test("ignores negative port", () => {
    expect(getDevelopmentUrl({ QSTASH_DEV_PORT: "-1" })).toBe("http://127.0.0.1:8642");
  });

  test("ignores zero port", () => {
    expect(getDevelopmentUrl({ QSTASH_DEV_PORT: "0" })).toBe("http://127.0.0.1:8642");
  });
});

describe("getDevelopmentCredentials", () => {
  test("returns hardcoded dev credentials with default port", () => {
    const creds = getDevelopmentCredentials({});
    expect(creds.token).toBe(DEV_QSTASH_TOKEN);
    expect(creds.currentSigningKey).toBe(DEV_QSTASH_CURRENT_SIGNING_KEY);
    expect(creds.nextSigningKey).toBe(DEV_QSTASH_NEXT_SIGNING_KEY);
    expect(creds.baseUrl).toBe("http://127.0.0.1:8642");
  });

  test("respects custom port", () => {
    const creds = getDevelopmentCredentials({ QSTASH_DEV_PORT: "7777" });
    expect(creds.baseUrl).toBe("http://127.0.0.1:7777");
  });
});

describe("getRuntime", () => {
  test("returns nodejs in bun/node environment", () => {
    // In bun test runner, process.release.name is set
    expect(getRuntime()).toBe("nodejs");
  });
});
