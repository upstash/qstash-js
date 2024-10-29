import type { HeadersInit } from "../types";
import { BaseProvider } from "./base";
import type { LLMOptions, LLMOwner, ProviderInfo } from "./types";

export class LLMProvider<TOwner extends LLMOwner> extends BaseProvider<"llm", LLMOwner> {
  public readonly apiKind = "llm";
  public readonly organization?: string;

  constructor(baseUrl: string, token: string, owner: TOwner, organization?: string) {
    super(baseUrl, token, owner);
    this.organization = organization;
  }

  getRoute(): string[] {
    return this.owner === "anthropic" ? ["v1", "messages"] : ["v1", "chat", "completions"];
  }

  getHeaders(): HeadersInit {
    const header = this.owner === "anthropic" ? "x-api-key" : "authorization";
    const headerValue = this.owner === "anthropic" ? this.token : `Bearer ${this.token}`;
    return {
      [header]: headerValue,
      ...(this.organization
        ? {
            "OpenAI-Organization": this.organization,
          }
        : {}),
    };
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
      return this.updateWithAnalytics(providerInfo, options.analytics, this.owner === "upstash");
    }

    return providerInfo;
  }

  private updateWithAnalytics(
    providerInfo: ProviderInfo,
    analytics: Required<LLMOptions>["analytics"],
    isUpstash: boolean
  ): ProviderInfo {
    switch (analytics.name) {
      case "helicone": {
        // @ts-expect-error unsafe call
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        providerInfo.appendHeaders.set("Helicone-Auth", `Bearer ${analytics.token}`);
        if (isUpstash) {
          providerInfo.baseUrl = "https://qstash.helicone.ai";
          providerInfo.route = ["llm", "v1", "chat", "completions"];
        } else {
          // @ts-expect-error unsafe call
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          providerInfo.appendHeaders.set("Helicone-Target-Url", providerInfo.url);

          providerInfo.baseUrl = "https://gateway.helicone.ai";
          providerInfo.route = ["v1", "chat", "completions"];
        }
        return providerInfo;
      }
      default: {
        throw new Error("Unknown analytics provider");
      }
    }
  }
}

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
