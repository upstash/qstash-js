import {
  buildBulkActionFilterPayload,
  DEFAULT_BULK_COUNT,
  prefixHeaders,
  processHeaders,
  serializeLabel,
} from "./utils";
import { describe, expect, test } from "bun:test";
import type { DLQBulkActionFilters, MessageCancelFilters } from "./filter-types";

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
  test("should return default count for all: true", () => {
    expect(buildBulkActionFilterPayload({ all: true })).toEqual({
      count: DEFAULT_BULK_COUNT,
      cursor: undefined,
    });
  });

  test("should allow overriding count for all: true", () => {
    expect(buildBulkActionFilterPayload({ all: true, count: 100 })).toEqual({
      count: 100,
      cursor: undefined,
    });
  });

  test("should return default count for filter", () => {
    const request: DLQBulkActionFilters = { filter: { label: "test" } };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("count", DEFAULT_BULK_COUNT);
  });

  test("should allow overriding count for filter", () => {
    const request: DLQBulkActionFilters = { filter: { label: "test" }, count: 100 };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("count", 100);
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

  test("should pass multi-value cancel filters through as arrays", () => {
    const request: MessageCancelFilters = {
      filter: {
        url: ["https://a.com", "https://b.com"],
        callerIp: ["1.2.3.4", "5.6.7.8"],
        flowControlKey: ["key-1", "key-2"],
        scheduleId: ["scd_1", "scd_2"],
        queueName: ["queue-1", "queue-2"],
      },
    };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("url", ["https://a.com", "https://b.com"]);
    expect(result).toHaveProperty("callerIp", ["1.2.3.4", "5.6.7.8"]);
    expect(result).toHaveProperty("flowControlKey", ["key-1", "key-2"]);
    expect(result).toHaveProperty("scheduleId", ["scd_1", "scd_2"]);
    expect(result).toHaveProperty("queueName", ["queue-1", "queue-2"]);
  });

  test("should rename multi-value urlGroup to topicName", () => {
    const request: MessageCancelFilters = {
      filter: { urlGroup: ["group-1", "group-2"] },
    };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("topicName", ["group-1", "group-2"]);
    expect(result).not.toHaveProperty("urlGroup");
  });

  test("should pass host and path cancel filters through", () => {
    const request: MessageCancelFilters = {
      filter: { host: ["a.com", "b.com"], path: "/webhook" },
    };
    const result = buildBulkActionFilterPayload(request);
    expect(result).toHaveProperty("host", ["a.com", "b.com"]);
    expect(result).toHaveProperty("path", "/webhook");
  });
});

describe("serializeLabel", () => {
  test("should return a single label as-is", () => {
    expect(serializeLabel("my-label")).toBe("my-label");
  });

  test("should join multiple labels with a comma", () => {
    expect(serializeLabel(["label-1", "label-2"])).toBe("label-1,label-2");
  });
});

describe("processHeaders", () => {
  test("should set Upstash-Label header if label is present", () => {
    const headers = processHeaders({ url: "https://example.com", label: "my-label" });
    expect(headers.get("Upstash-Label")).toBe("my-label");
  });

  test("should set comma-separated Upstash-Label header for an array of labels", () => {
    const headers = processHeaders({
      url: "https://example.com",
      label: ["label-1", "label-2"],
    });
    expect(headers.get("Upstash-Label")).toBe("label-1,label-2");
  });
});
