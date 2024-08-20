export type ProviderReturnType = {
  owner: "upstash" | "openai" | "custom";
  baseUrl: string;
  token: string;
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

const upstash = (): {
  owner: "upstash";
  baseUrl: "https://qstash.upstash.io/llm";
  token: string;
} => {
  return {
    owner: "upstash",
    baseUrl: "https://qstash.upstash.io/llm",
    token: "",
  };
};

const openai = ({
  token,
}: {
  token: string;
}): { owner: "openai"; baseUrl: "https://api.openai.com"; token: string } => {
  return { token: token, owner: "openai", baseUrl: "https://api.openai.com" };
};

const custom = ({
  baseUrl,
  token,
}: {
  token: string;
  baseUrl: string;
}): { owner: "custom"; baseUrl: string; token: string } => {
  const trimmedBaseUrl = baseUrl.replace(/\/(v1\/)?chat\/completions$/, ""); // Will trim /v1/chat/completions and /chat/completions
  return {
    token,
    owner: "custom",
    baseUrl: trimmedBaseUrl,
  };
};
export { custom, openai, upstash };
