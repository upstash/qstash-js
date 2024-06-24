import type { PublishRequest } from "../client";
import { PROVIDER_MAP } from "./constants";

/**
 * Appends necessary LLM (Language Model) options such as the required token and authorization header to the request.
 *
 * This function checks the `llmProvider` property in the request to determine which provider (OpenAI or TogetherAI)
 * to use and appends the appropriate options. By default, it checks environment variables for API keys if they are not
 * provided in the request. The function also sets the request URL if it is not already specified.
 *
 * @param request - The request object which may contain `llmProvider`, `llmToken`, and `url`.
 * @param headers - The Headers object to which the authorization token will be appended.
 *
 * @template TBody - The type of the request body.
 * @template TRequest - The type of the publish request extending `PublishRequest`.
 */
export function appendLLMOptions<
  TBody = unknown,
  TRequest extends PublishRequest<TBody> = PublishRequest<TBody>,
>(request: TRequest, headers: Headers) {
  if ("llmProvider" in request) {
    const llmProvider = request.llmProvider;

    if (llmProvider === "openai") {
      const token = process.env.OPENAI_API_KEY ?? request.llmToken;
      request.url = request.url ?? `${PROVIDER_MAP[llmProvider]}/v1/chat/completion`;
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (llmProvider === "togetherai") {
      const token = process.env.TOGETHER_API_KEY ?? request.llmToken;
      request.url = request.url ?? `${PROVIDER_MAP[llmProvider]}/v1/chat/completion`;
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
}
