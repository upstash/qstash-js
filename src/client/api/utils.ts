import type { PublishRequest } from "../client";
import type { LLMOptions, ProviderInfo, PublishEmailApi, PublishLLMApi } from "./types";
import { upstash } from "./llm";

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
  };

  return finalProvider.onFinish(providerInfo, parameters);
};

/**
 * copies and updates the request by removing the api field and adding url & headers.
 *
 * if there is no api field, simply returns.
 *
 * @param request request with api field
 * @param upstashToken used if provider is upstash and token is not set
 * @returns updated request
 */
export const processApi = (
  request: PublishRequest<unknown>,
  upstashToken: string
): PublishRequest<unknown> => {
  if (!request.api) {
    return request;
  }

  const { url, appendHeaders, owner } = getProviderInfo(request.api, upstashToken);

  if (request.api.name === "llm") {
    const callback = request.callback;
    if (!callback) {
      throw new TypeError("Callback cannot be undefined when using LLM api.");
    }

    return {
      ...request,
      // @ts-expect-error undici header conflict
      headers: new Headers({
        ...request.headers,
        ...appendHeaders,
      }),
      ...(owner === "upstash" && !request.api.analytics
        ? { api: { name: "llm" }, url: undefined, callback }
        : { url, api: undefined }),
    };
  } else {
    return {
      ...request,
      // @ts-expect-error undici header conflict
      headers: new Headers({
        ...request.headers,
        ...appendHeaders,
      }),
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
