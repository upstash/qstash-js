import type { PublishRequest } from "../client";
import type { Requester } from "../http";
import type { AnalyticsConfig, AnalyticsSetup } from "./providers";
import { setupAnalytics } from "./providers";

export function appendLLMOptionsIfNeeded<
  TBody = unknown,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
>(request: TRequest, headers: Headers, http: Requester) {
  if (request.api?.name !== "llm") return;

  const provider = request.api.provider;
  const analytics = request.api.analytics;

  if (provider?.owner === "upstash") {
    handleUpstashProvider(request, headers, http, analytics);
    return;
  }

  if (!("provider" in request.api)) return;

  const { baseUrl, token } = validateProviderConfig(provider);

  const analyticsConfig = analytics
    ? setupAnalytics({ name: analytics.name, token: analytics.token }, token, baseUrl, "custom")
    : undefined;
  if (analyticsConfig) {
    setAnalyticsHeaders(headers, analyticsConfig);
    request.url = analyticsConfig.baseURL;
  } else {
    request.url = `${baseUrl}/v1/chat/completions`;
    headers.set("Authorization", `Bearer ${token}`);
  }
}

function handleUpstashProvider(
  request: PublishRequest<unknown>,
  headers: Headers,
  http: Requester,
  analytics?: AnalyticsConfig
) {
  if (analytics) {
    const analyticsConfig = setupAnalytics(
      { name: analytics.name, token: analytics.token },
      //@ts-expect-error hacky way to get bearer token
      String(http.authorization).split("Bearer ")[1],
      request.api?.provider?.baseUrl,
      "upstash"
    );
    setAnalyticsHeaders(headers, analyticsConfig);
    request.url = analyticsConfig.baseURL;
  } else {
    request.api = { name: "llm" };
  }
}

function validateProviderConfig(provider?: { baseUrl?: string; token?: string }) {
  if (!provider?.baseUrl) throw new Error("baseUrl cannot be empty or undefined!");
  if (!provider.token) throw new Error("token cannot be empty or undefined!");

  return { baseUrl: provider.baseUrl, token: provider.token };
}

function setAnalyticsHeaders(headers: Headers, analyticsConfig: AnalyticsSetup) {
  headers.set("Helicone-Auth", analyticsConfig.defaultHeaders?.["Helicone-Auth"] ?? "");
  headers.set("Authorization", analyticsConfig.defaultHeaders?.Authorization ?? "");
  if (analyticsConfig.defaultHeaders?.["Helicone-Target-Url"]) {
    headers.set("Helicone-Target-Url", analyticsConfig.defaultHeaders["Helicone-Target-Url"]);
  }
}

/**
 * Ensures that a callback is present in the request when using the LLM API.
 *
 * @template TBody - The type of the request body.
 * @param {PublishRequest<TBody>} request - The request object to be validated.
 * @throws {TypeError} Throws an error if the request is for the LLM API and the callback is missing.
 */
export function ensureCallbackPresent<TBody = unknown>(request: PublishRequest<TBody>) {
  if (request.api?.name === "llm" && !request.callback) {
    throw new TypeError("Callback cannot be undefined when using LLM");
  }
}
