import type { LLMOwner } from "../api/types";

type AnalyticsConfig = { name: "helicone"; token: string };

type AnalyticsSetup = {
  baseURL?: string;
  defaultHeaders?: Record<string, string | undefined>;
};

export const setupAnalytics = (
  analytics: AnalyticsConfig | undefined,
  providerApiKey: string,
  providerBaseUrl?: string,
  provider?: LLMOwner
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
