import type { PublishRequest } from "../client";
import type { LLMOptions, ProviderInfo, PublishEmailApi, PublishLLMApi } from "./types";
import { upstash } from "./llm";
import type { HeadersInit } from "../types";

/**
 * copies and updates the request by removing the api field and adding url & headers.
 *
 * @param api api field of PublishRequest
 * @param upstashToken used if provider is upstash and token is not set
 * @returns updated request
 */
export const getProviderInfo = (
  api: PublishEmailApi | PublishLLMApi,
  upstashToken: string
): ProviderInfo => {
  const { name, provider, ...parameters } = api;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const finalProvider = provider ?? upstash();

  // use upstash token if it's not set
  if (finalProvider.owner === "upstash" && !finalProvider.token) {
    finalProvider.token = upstashToken;
  }

  // validate provider
  if (!finalProvider.baseUrl) throw new TypeError("baseUrl cannot be empty or undefined!");
  if (!finalProvider.token) throw new TypeError("token cannot be empty or undefined!");
  if (finalProvider.apiKind !== name) {
    throw new TypeError(
      `Unexpected api name. Expected '${finalProvider.apiKind}', received ${name}`
    );
  }

  const providerInfo: ProviderInfo = {
    url: finalProvider.getUrl(),
    baseUrl: finalProvider.baseUrl,
    route: finalProvider.getRoute(),
    appendHeaders: finalProvider.getHeaders(parameters),
    owner: finalProvider.owner,
    method: finalProvider.method,
  };

  return finalProvider.onFinish(providerInfo, parameters);
};

/**
 * joins two header sets. If the same header exists in both headers and record,
 * one in headers is used.
 *
 * The reason why we added this method is because the following doesn't work:
 *
 * ```ts
 * const joined = {
 *   ...headers,
 *   ...record
 * }
 * ```
 *
 * `headers.toJSON` could have worked, but it exists in bun, and not necessarily in
 * other runtimes.
 *
 * @param headers Headers object
 * @param record record
 * @returns joined header
 */
const safeJoinHeaders = (headers: Headers, record: Record<string, string>) => {
  const joinedHeaders = new Headers(record);
  for (const [header, value] of headers.entries()) {
    joinedHeaders.set(header, value);
  }
  return joinedHeaders as HeadersInit;
};

/**
 * copies and updates the request by removing the api field and adding url & headers.
 *
 * if there is no api field, simply returns after overwriting headers with the passed headers.
 *
 * @param request request with api field
 * @param headers processed headers. Previously, these headers were assigned to the request
 *   when the headers were calculated. But PublishRequest.request type (HeadersInit) is broader
 *   than headers (Headers). PublishRequest.request is harder to work with, so we set them here.
 * @param upstashToken used if provider is upstash and token is not set
 * @returns updated request
 */
export const processApi = (
  request: PublishRequest<unknown>,
  headers: Headers,
  upstashToken: string
): PublishRequest<unknown> => {
  if (!request.api) {
    request.headers = headers;
    return request;
  }

  const { url, appendHeaders, owner, method } = getProviderInfo(request.api, upstashToken);

  if (request.api.name === "llm") {
    const callback = request.callback;
    if (!callback) {
      throw new TypeError("Callback cannot be undefined when using LLM api.");
    }

    return {
      ...request,
      method: request.method ?? method,
      headers: safeJoinHeaders(headers, appendHeaders),
      ...(owner === "upstash" && !request.api.analytics
        ? { api: { name: "llm" }, url: undefined, callback }
        : { url, api: undefined }),
    };
  } else {
    return {
      ...request,
      method: request.method ?? method,
      headers: safeJoinHeaders(headers, appendHeaders),
      url,
      api: undefined,
    };
  }
};

export function updateWithAnalytics(
  providerInfo: ProviderInfo,
  analytics: Required<LLMOptions>["analytics"]
): ProviderInfo {
  switch (analytics.name) {
    case "helicone": {
      providerInfo.appendHeaders["Helicone-Auth"] = `Bearer ${analytics.token}`;
      if (providerInfo.owner === "upstash") {
        updateProviderInfo(providerInfo, "https://qstash.helicone.ai", [
          "llm",
          ...providerInfo.route,
        ]);
      } else {
        providerInfo.appendHeaders["Helicone-Target-Url"] = providerInfo.baseUrl;

        updateProviderInfo(providerInfo, "https://gateway.helicone.ai", providerInfo.route);
      }
      return providerInfo;
    }
    default: {
      throw new Error("Unknown analytics provider");
    }
  }
}

function updateProviderInfo(providerInfo: ProviderInfo, baseUrl: string, route: string[]) {
  providerInfo.baseUrl = baseUrl;
  providerInfo.route = route;
  providerInfo.url = `${baseUrl}/${route.join("/")}`;
}
