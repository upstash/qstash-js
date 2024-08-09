import type { PublishRequest } from "../client";
import { analyticsBaseUrlMap } from "./providers";

/**
 * Appends necessary LLM (Language Model) options such as the required token and authorization header to the request.
 *
 * This function checks the `provider` property in the request to determine which provider
 * to use and appends the appropriate options.
 *
 * @param request - The request object which may contain `provider` that holds `token` and `baseUrl`.
 * @param headers - The Headers object to which the authorization token will be appended.
 *
 * @template TBody - The type of the request body.
 * @template TRequest - The type of the publish request extending `PublishRequest`.
 */
export function appendLLMOptionsIfNeeded<
  TBody = unknown,
  TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
>(request: TRequest, headers: Headers) {
  //If the provider owner is "upstash", switch request API to "llm" and exit the function.

  if (request.api?.provider?.owner === "upstash") {
    request.api = { name: "llm" };
    return;
  }

  // Append mandatory fields for calling 3rd party providers
  if (request.api && "provider" in request.api) {
    const provider = request.api.provider;

    if (!provider?.baseUrl) throw new Error("baseUrl cannot be empty or undefined!");
    if (!provider.token) throw new Error("token cannot be empty or undefined!");

    if (request.api.analytics) {
      const analyticsToken = request.api.analytics.token;
      const analyticsName = request.api.analytics.name;
      const { baseURL, headers: defaultHeaders } = analyticsBaseUrlMap(
        analyticsName,
        analyticsToken,
        provider.token,
        provider.baseUrl
      );

      request.url = baseURL;
      headers.set("Helicone-Auth", defaultHeaders["Helicone-Auth"]);
      headers.set("Helicone-Target-Url", defaultHeaders["Helicone-Target-Url"]);
      headers.set("Authorization", defaultHeaders.Authorization);
    } else {
      request.url = `${provider.baseUrl}/v1/chat/completions`;
      headers.set("Authorization", `Bearer ${provider.token}`);
    }
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
