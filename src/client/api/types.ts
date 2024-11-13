import type { BaseProvider } from "./base";

export type ProviderInfo = {
  /**
   * full url used for request
   */
  url: string;
  /**
   * base url of the request
   */
  baseUrl: string;
  /**
   * route elements which will follow the baseUrl
   */
  route: string[];
  /**
   * headers to include in the request
   */
  appendHeaders: Record<string, string>;
  /**
   * provider owner
   */
  owner: Owner;
};

export type ApiKind = "llm" | "email";
export type Owner = EmailOwner | LLMOwner;

type PublishApi<TName extends ApiKind, TProvider extends BaseProvider<TName>> = {
  name: TName;
  provider?: TProvider;
};

/**
 * Email
 */
export type EmailOwner = "resend";
export type PublishEmailApi = Required<PublishApi<"email", BaseProvider<"email", EmailOwner>>>;

/**
 * LLM
 */
export type LLMOwner = "upstash" | "openai" | "anthropic" | "custom";
export type LLMOptions = {
  analytics?: {
    name: "helicone";
    /**
     * Helicone API token
     */
    token: string;
    /**
     * baseUrl for helicone.
     *
     * by default, it will be `https://qstash.helicone.ai` for upstash llm
     * and `https://gateway.helicone.ai` for others.
     *
     * See Helicone docs for integrations and their baseURL
     * https://docs.helicone.ai/getting-started/integration-method/gateway
     */
    baseUrl?: string;
  };
};
export type PublishLLMApi = PublishApi<"llm", BaseProvider<"llm", LLMOwner>> & LLMOptions;
