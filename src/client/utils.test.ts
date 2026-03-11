import { buildBulkActionFilterPayload, processHeaders } from "./utils";
import { describe, expect, test } from "bun:test";
import { prefixHeaders } from "./utils";
import type { DLQBulkActionFilters } from "./filter-types";

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
  test("should return empty object for all: true", () => {
    expect(buildBulkActionFilterPayload({ all: true })).toEqual({ cursor: undefined });
  });

  test("should return dlqIds when provided", () => {
    expect(buildBulkActionFilterPayload({ dlqIds: ["id1", "id2"] })).toEqual({
      dlqIds: ["id1", "id2"],
      cursor: undefined,
    });
  });

  test("should return messageIds when provided", () => {
    expect(buildBulkActionFilterPayload({ messageIds: ["id1"] })).toEqual({
      messageIds: ["id1"],
      cursor: undefined,
    });
  });

  test("should rename urlGroup to topicName in filter", () => {
    const request: DLQBulkActionFilters = { filter: { urlGroup: "my-group", label: "test" } };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("topicName", "my-group");
    expect(result).toHaveProperty("label", "test");
    expect(result).not.toHaveProperty("urlGroup");
  });

  test("should pass callerIp through as-is", () => {
    const request: DLQBulkActionFilters = { filter: { callerIp: "1.2.3.4" } };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("callerIp", "1.2.3.4");
  });
});

describe("processHeaders", () => {
  test("should set Upstash-Label header if label is present", () => {
    const headers = processHeaders({ url: "https://example.com", label: "my-label" });
    expect(headers.get("Upstash-Label")).toBe("my-label");
  });
});
