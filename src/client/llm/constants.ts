import type { LlmProviderBaseUrl, LlmProvider } from "./types";

export const PROVIDER_MAP: Record<LlmProvider, LlmProviderBaseUrl> = {
  openai: "https://api.openai.com",
  togetherai: "https://api.together.xyz",
};
