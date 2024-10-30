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

  getHeaders(): Record<string, string> {
    // don't send auth header in upstash
    if (this.owner === "upstash") {
      return {};
    }

    const header = this.owner === "anthropic" ? "x-api-key" : "authorization";
    const headerValue = this.owner === "anthropic" ? this.token : `Bearer ${this.token}`;

    const headers = { [header]: headerValue };
    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
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
      return this.updateWithAnalytics(providerInfo, options.analytics);
    }

    return providerInfo;
  }

  private updateWithAnalytics(
    providerInfo: ProviderInfo,
    analytics: Required<LLMOptions>["analytics"]
  ): ProviderInfo {
    switch (analytics.name) {
      case "helicone": {
        providerInfo.appendHeaders["Helicone-Auth"] = `Bearer ${analytics.token}`;
        if (providerInfo.owner === "upstash") {
          this.updateProviderInfo(providerInfo, "https://qstash.helicone.ai", [
            "llm",
            "v1",
            "chat",
            "completions",
          ]);
        } else {
          providerInfo.appendHeaders["Helicone-Target-Url"] = providerInfo.url;

          this.updateProviderInfo(providerInfo, "https://gateway.helicone.ai", [
            "v1",
            "chat",
            "completions",
          ]);
        }
        return providerInfo;
      }
      default: {
        throw new Error("Unknown analytics provider");
      }
    }
  }

  private updateProviderInfo(providerInfo: ProviderInfo, baseUrl: string, route: string[]) {
    providerInfo.baseUrl = baseUrl;
    providerInfo.route = route;
    providerInfo.url = `${baseUrl}/${route.join("/")}`;
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
