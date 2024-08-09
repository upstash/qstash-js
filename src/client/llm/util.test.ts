import { describe, expect, test } from "bun:test";
import { analyticsBaseUrlMap } from "./providers";
import { appendLLMOptionsIfNeeded } from "./utils";

describe("appendLLMOptionsIfNeeded", () => {
  test("should switch to 'llm' API when provider owner is 'upstash'", () => {
    const request = {
      api: {
        provider: {
          owner: "upstash",
        },
      },
    };
    const headers = new Headers();

    //@ts-expect-error ts compiler silencer
    appendLLMOptionsIfNeeded(request, headers);

    //@ts-expect-error ts compiler silencer
    expect(request.api).toEqual({ name: "llm" });
    expect(headers.get("Authorization")).toBeNull();
    expect([...headers.entries()]).toHaveLength(0); // Ensure no headers were set
  });

  test("should throw error when baseUrl is missing", () => {
    const request = {
      api: {
        provider: {
          token: "test-token",
        },
      },
    };
    const headers = new Headers();

    expect(() => {
      //@ts-expect-error ts compiler silencer
      appendLLMOptionsIfNeeded(request, headers);
    }).toThrow("baseUrl cannot be empty or undefined!");
  });

  test("should throw error when token is missing", () => {
    const request = {
      api: {
        provider: {
          baseUrl: "https://api.example.com",
        },
      },
    };
    const headers = new Headers();

    expect(() => {
      //@ts-expect-error ts compiler silencer
      appendLLMOptionsIfNeeded(request, headers);
    }).toThrow("token cannot be empty or undefined!");
  });

  test("should set correct headers and URL for non-analytics provider -ozoz", () => {
    const request = {
      api: {
        provider: {
          baseUrl: "https://api.example.com",
          token: "test-token",
        },
      },
    };
    const headers = new Headers();

    //@ts-expect-error ts compiler silencer
    appendLLMOptionsIfNeeded(request, headers);

    //@ts-expect-error ts compiler silencer
    expect(request.url).toBe("https://api.example.com/v1/chat/completions");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  test("should set correct headers and URL for analytics provider", () => {
    const request = {
      api: {
        provider: {
          baseUrl: "https://api.example.com",
          token: "provider-token",
        },
        analytics: {
          name: "helicone",
          token: "analytics-token",
        },
      },
    };
    const headers = new Headers();

    //@ts-expect-error ts compiler silencer
    appendLLMOptionsIfNeeded(request, headers);

    // Use the actual analyticsBaseUrlMap function to get expected values
    const { baseURL, headers: expectedHeaders } = analyticsBaseUrlMap(
      //@ts-expect-error ts compiler silencer
      request.api.analytics.name,
      request.api.analytics.token,
      request.api.provider.token,
      request.api.provider.baseUrl
    );

    //@ts-expect-error ts compiler silencer
    expect(request.url).toBe(baseURL);
    expect(headers.get("Helicone-Auth")).toBe(expectedHeaders["Helicone-Auth"]);
    expect(headers.get("Helicone-Target-Url")).toBe(expectedHeaders["Helicone-Target-Url"]);
    expect(headers.get("Authorization")).toBe(expectedHeaders.Authorization);
  });

  test("should not modify request or headers when api is not present", () => {
    const request = {};
    const headers = new Headers();

    //@ts-expect-error ts compiler silencer
    appendLLMOptionsIfNeeded(request, headers);

    expect(request).toEqual({});
    expect([...headers.entries()]).toHaveLength(0);
  });
});
