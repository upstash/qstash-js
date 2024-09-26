import { describe, expect, test } from "bun:test";
import { custom, openai } from "./providers";

describe("Provider helpers", () => {
  test("should trim /chat/completion/if you user fullUrl", () => {
    expect(custom({ baseUrl: "https://api.together.xyz/chat/completions", token: "xxx" })).toEqual({
      baseUrl: "https://api.together.xyz",
      token: "xxx",
      owner: "custom",
      organization: undefined,
    });
  });
  test("should trim /v1/chat/completion/if you user fullUrl", () => {
    expect(
      custom({ baseUrl: "https://api.together.xyz/v1/chat/completions", token: "xxx" })
    ).toEqual({
      baseUrl: "https://api.together.xyz",
      token: "xxx",
      owner: "custom",
      organization: undefined,
    });
  });
  test("should set organization if passed (openai)", () => {
    const testOrg = "my-org";
    expect(
      openai({
        token: "xxx",
        organization: testOrg,
      })
    ).toEqual({
      baseUrl: "https://api.openai.com",
      token: "xxx",
      owner: "openai",
      organization: testOrg,
    });
  });
});
