import { processHeaders } from "./utils";
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

describe("processHeaders", () => {
  test("should set Upstash-Label header if label is present", () => {
    const headers = processHeaders({ url: "https://example.com", label: "my-label" });
    expect(headers.get("Upstash-Label")).toBe("my-label");
  });
});
