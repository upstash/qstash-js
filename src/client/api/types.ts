import type { HTTPMethods } from "../types";
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
  /**
   * method to use in the request
   */
  method: HTTPMethods;
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
  analytics?: { name: "helicone"; token: string };
};
export type PublishLLMApi = PublishApi<"llm", BaseProvider<"llm", LLMOwner>> & LLMOptions;
