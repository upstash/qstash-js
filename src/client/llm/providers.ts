type Owner = "upstash" | "openai" | "custom";
export type ProviderReturnType<
  TOwner extends Owner = Owner,
  TBaseUrl extends string = string,
  TToken extends string = string,
  TOrganization extends string | undefined = string | undefined,
> = {
  owner: TOwner;
  baseUrl: TBaseUrl;
  token: TToken;
  organization: TOrganization;
};

export type AnalyticsConfig = { name: "helicone"; token: string };

export type AnalyticsSetup = {
  baseURL?: string;
  defaultHeaders?: Record<string, string | undefined>;
};

export const setupAnalytics = (
  analytics: AnalyticsConfig | undefined,
  providerApiKey: string,
  providerBaseUrl?: string,
  provider?: "openai" | "upstash" | "custom"
): AnalyticsSetup => {
  if (!analytics) return {};

  switch (analytics.name) {
    case "helicone": {
      switch (provider) {
        case "upstash": {
          return {
            baseURL: "https://qstash.helicone.ai/llm/v1/chat/completions",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${analytics.token}`,
              Authorization: `Bearer ${providerApiKey}`,
            },
          };
        }
        default: {
          return {
            baseURL: "https://gateway.helicone.ai/v1/chat/completions",
            defaultHeaders: {
              "Helicone-Auth": `Bearer ${analytics.token}`,
              "Helicone-Target-Url": providerBaseUrl,
              Authorization: `Bearer ${providerApiKey}`,
            },
          };
        }
      }
    }
    default: {
      throw new Error("Unknown analytics provider");
    }
  }
};

const upstash = (): ProviderReturnType<"upstash", "https://qstash.upstash.io/llm", ""> => {
  return {
    owner: "upstash",
    baseUrl: "https://qstash.upstash.io/llm",
    token: "",
    organization: undefined,
  };
};

const openai = <
  TToken extends string = string,
  TOrganization extends string | undefined = undefined,
>({
  token,
  organization,
}: {
  token: TToken;
  organization?: TOrganization;
}): ProviderReturnType<
  "openai",
  "https://api.openai.com",
  TToken,
  TOrganization extends string ? TOrganization : undefined
> => {
  return {
    token,
    owner: "openai",
    baseUrl: "https://api.openai.com",
    organization: organization as TOrganization extends string ? TOrganization : undefined,
  };
};

const custom = <TToken extends string = string>({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token: TToken;
}): ProviderReturnType<"custom", string, TToken> => {
  const trimmedBaseUrl = baseUrl.replace(/\/(v1\/)?chat\/completions$/, ""); // Will trim /v1/chat/completions and /chat/completions
  return {
    token,
    owner: "custom",
    baseUrl: trimmedBaseUrl,
    organization: undefined,
  };
};
export { custom, openai, upstash };
