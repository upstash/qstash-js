import { buildBulkActionFilterPayload, processHeaders } from "./utils";
import { describe, expect, test } from "bun:test";
import { prefixHeaders } from "./utils";

describe("prefixHeaders", () => {
  test("should keep headers starting with upstash as they are - Upstash-", () => {
    const headers = prefixHeaders(
      //@ts-expect-error caused by undici and bunjs type overlap
      new Headers({
        "Upstash-Forward-myheader": "forward-header-value",
        "Upstash-Callback-Forward-myheader": "callback-forward-header-value",
        "some-other-header": "other-value",
      })
    );

    expect(headers.get("Upstash-Forward-myheader")).toBe("forward-header-value");
    expect(headers.get("Upstash-Callback-Forward-myheader")).toBe("callback-forward-header-value");
    expect(headers.get("some-other-header")).toBeNull();
    expect(headers.get("Upstash-Forward-some-other-header")).toBe("other-value");
  });
});

describe("buildFilterPayload", () => {
  test("should throw when called with an empty object", () => {
    // @ts-expect-error intentionally bypassing type check to verify runtime guard
    expect(() => buildBulkActionFilterPayload({})).toThrow("No filters provided");
  });

  test("should throw when dlqIds and all are combined", () => {
    expect(() =>
      // @ts-expect-error intentionally bypassing type check to verify runtime guard
      buildBulkActionFilterPayload({ dlqIds: ["id1"], all: true })
    ).toThrow("dlqIds and all: true are mutually exclusive");
  });

  test("should throw when dlqIds is combined with filter fields", () => {
    expect(() =>
      // @ts-expect-error intentionally bypassing type check to verify runtime guard
      buildBulkActionFilterPayload({ dlqIds: ["id1"], url: "https://example.com" })
    ).toThrow("dlqIds cannot be combined with filter fields");
  });

  test("should throw when all: true is combined with filter fields", () => {
    expect(() =>
      // @ts-expect-error intentionally bypassing type check to verify runtime guard
      buildBulkActionFilterPayload({ all: true, url: "https://example.com" })
    ).toThrow("all: true cannot be combined with filter fields");
  });

  test("should return empty object for all: true", () => {
    expect(buildBulkActionFilterPayload({ all: true })).toEqual({});
  });
});

describe("processHeaders", () => {
  test("should set Upstash-Label header if label is present", () => {
    const headers = processHeaders({ url: "https://example.com", label: "my-label" });
    expect(headers.get("Upstash-Label")).toBe("my-label");
  });
});
