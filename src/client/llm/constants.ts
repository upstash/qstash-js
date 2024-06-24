import type { ProviderBaseUrls, Providers } from "./types";

export const PROVIDER_MAP: Record<Providers, ProviderBaseUrls> = {
  openai: "https://api.openai.com",
  togetherai: "https://api.together.xyz",
};
