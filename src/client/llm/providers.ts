import type { LLMOwner } from "../api/types";

type AnalyticsConfig = { name: "helicone"; token: string };

type AnalyticsSetup = {
  baseURL?: string;
  defaultHeaders?: Record<string, string | undefined>;
};

export const setupAnalytics = (
  analytics: AnalyticsConfig | undefined,
  provider: LLMOwner,
  providerApiKey: string,
  providerBaseUrl?: string
): AnalyticsSetup => {
  if (!analytics) return {};

  switch (analytics.name) {
    case "helicone": {
      switch (provider) {
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
