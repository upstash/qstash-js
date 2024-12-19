import { BaseProvider } from "./base";
import type { LLMOptions, LLMOwner, ProviderInfo } from "./types";
import { updateWithAnalytics } from "./utils";

export class LLMProvider<TOwner extends LLMOwner> extends BaseProvider<"llm", LLMOwner> {
  public readonly apiKind = "llm";
  public readonly organization?: string;
  public readonly method = "POST";

  constructor(baseUrl: string, token: string, owner: TOwner, organization?: string) {
    super(baseUrl, token, owner);
    this.organization = organization;
  }

  getRoute(): string[] {
    return this.owner === "anthropic" ? ["v1", "messages"] : ["v1", "chat", "completions"];
  }

  getHeaders(options: LLMOptions): Record<string, string> {
    // don't send auth header in upstash
    if (this.owner === "upstash" && !options.analytics) {
      return { "content-type": "application/json" };
    }

    const header = this.owner === "anthropic" ? "x-api-key" : "authorization";
    const headerValue = this.owner === "anthropic" ? this.token : `Bearer ${this.token}`;

    const headers = {
      [header]: headerValue,
      "content-type": "application/json",
    };

    if (this.owner === "openai" && this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }

    if (this.owner === "anthropic") {
      headers["anthropic-version"] = "2023-06-01";
    }

    return headers;
  }

  /**
   * Checks if callback exists and adds analytics in place if it's set.
   *
   * @param request
   * @param options
   */
  onFinish(providerInfo: ProviderInfo, options: LLMOptions): ProviderInfo {
    // add analytics if they exist
    if (options.analytics) {
      return updateWithAnalytics(providerInfo, options.analytics);
    }

    return providerInfo;
  }
}

// PROVIDERS

/**
 * @deprecated as of version 2.7.17. Will be removed in qstash-js 3.0.0.
 *
 * Please use an alternative LLM provider.
 *
 * openai: https://upstash.com/docs/qstash/integrations/llm
 * anthropic: https://upstash.com/docs/qstash/integrations/anthropic
 */
export const upstash = (): LLMProvider<"upstash"> => {
  return new LLMProvider("https://qstash.upstash.io/llm", "", "upstash");
};

export const openai = ({
  token,
  organization,
}: {
  token: string;
  organization?: string;
}): LLMProvider<"openai"> => {
  return new LLMProvider("https://api.openai.com", token, "openai", organization);
};

export const anthropic = ({ token }: { token: string }): LLMProvider<"anthropic"> => {
  return new LLMProvider("https://api.anthropic.com", token, "anthropic");
};

export const custom = ({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token: string;
}): LLMProvider<"custom"> => {
  const trimmedBaseUrl = baseUrl.replace(/\/(v1\/)?chat\/completions$/, ""); // Will trim /v1/chat/completions and /chat/completions
  return new LLMProvider(trimmedBaseUrl, token, "custom");
};
