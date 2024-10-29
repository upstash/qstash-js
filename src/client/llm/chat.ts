import type { Requester } from "../http";
import type { HeadersInit } from "../types";
import { setupAnalytics } from "./providers";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
  ChatRequest,
  PromptChatRequest,
  StreamEnabled,
  StreamParameter,
} from "./types";

export class Chat {
  private http: Requester;
  private token: string;

  constructor(http: Requester, token: string) {
    this.http = http;
    this.token = token;
  }

  private static toChatRequest<TStream extends StreamParameter>(
    request: PromptChatRequest<TStream>
  ): ChatRequest<TStream> {
    const messages: ChatCompletionMessage[] = [];

    messages.push(
      { role: "system", content: request.system },
      { role: "user", content: request.user }
    );

    const chatRequest: ChatRequest<TStream> = { ...request, messages };
    return chatRequest;
  }

  /**
   * Calls the Upstash completions api given a ChatRequest.
   *
   * Returns a ChatCompletion or a stream of ChatCompletionChunks
   * if stream is enabled.
   *
   * @param request ChatRequest with messages
   * @returns Chat completion or stream
   */
  create = async <TStream extends StreamParameter>(
    request: ChatRequest<TStream>
  ): Promise<
    TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion
  > => {
    // This section calls any non-Upstash LLM
    if (request.provider.owner != "upstash") return this.createThirdParty<TStream>(request);

    // This section calls Upstash LLMs
    const body = JSON.stringify(request);

    let baseUrl = undefined;
    let headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      ...("stream" in request && request.stream
        ? {
            Connection: "keep-alive",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          }
        : {}),
    };

    if (request.analytics) {
      const { baseURL, defaultHeaders } = setupAnalytics(
        { name: "helicone", token: request.analytics.token },
        this.getAuthorizationToken(),
        request.provider.baseUrl,
        "upstash"
      );
      headers = { ...headers, ...defaultHeaders };
      baseUrl = baseURL;
    }
    const path = request.analytics ? [] : ["llm", "v1", "chat", "completions"];

    return (
      "stream" in request && request.stream
        ? this.http.requestStream({
            path,
            method: "POST",
            headers,
            baseUrl,
            body,
          })
        : this.http.request({
            path,
            method: "POST",
            headers,
            baseUrl,
            body,
          })
    ) as Promise<
      TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion
    >;
  };

  /**
   * Calls the Upstash completions api given a ChatRequest.
   *
   * Returns a ChatCompletion or a stream of ChatCompletionChunks
   * if stream is enabled.
   *
   * @param request ChatRequest with messages
   * @returns Chat completion or stream
   */

  private createThirdParty = async <TStream extends StreamParameter>(
    request: ChatRequest<TStream>
  ): Promise<
    TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion
  > => {
    const { baseUrl, token, owner, organization } = request.provider;
    if (owner === "upstash") throw new Error("Upstash is not 3rd party provider!");

    //@ts-expect-error We need to delete the prop, otherwise openai throws an error
    delete request.provider;
    //@ts-expect-error We need to delete the prop, otherwise openai throws an error
    delete request.system;

    const analytics = request.analytics;
    //We need to delete the prop, otherwise openai or other llm providers throws an error
    delete request.analytics;

    const body = JSON.stringify(request);

    // Configures analytics headers and baseURL if analytics are provided, otherwise uses defaults
    const isAnalyticsEnabled = analytics?.name && analytics.token;

    const analyticsConfig =
      analytics?.name && analytics.token
        ? setupAnalytics({ name: analytics.name, token: analytics.token }, token, baseUrl, owner)
        : { defaultHeaders: undefined, baseURL: baseUrl };

    // Configures stream headers if stream is enabled
    const isStream = "stream" in request && request.stream;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(organization
        ? {
            "OpenAI-Organization": organization,
          }
        : {}),
      ...(isStream
        ? {
            Connection: "keep-alive",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          }
        : {}),
      ...analyticsConfig.defaultHeaders,
    };

    const response = await this.http[isStream ? "requestStream" : "request"]({
      path: isAnalyticsEnabled ? [] : ["v1", "chat", "completions"],
      method: "POST",
      headers,
      body,
      baseUrl: analyticsConfig.baseURL,
    });

    // Requiredassertion to satisfy ts
    return response as TStream extends StreamEnabled
      ? AsyncIterable<ChatCompletionChunk>
      : ChatCompletion;
  };

  // Helper method to get the authorization token
  private getAuthorizationToken(): string {
    //@ts-expect-error hacky way to get token from http module
    const authHeader = String(this.http.authorization);
    const match = /Bearer (.+)/.exec(authHeader);
    if (!match) {
      throw new Error("Invalid authorization header format");
    }
    return match[1];
  }

  /**
   * Calls the Upstash completions api given a PromptRequest.
   *
   * Returns a ChatCompletion or a stream of ChatCompletionChunks
   * if stream is enabled.
   *
   * @param request PromptRequest with system and user messages.
   *    Note that system parameter shouldn't be passed in the case of
   *    mistralai/Mistral-7B-Instruct-v0.2 model.
   * @returns Chat completion or stream
   */
  prompt = async <TStream extends StreamParameter>(
    request: PromptChatRequest<TStream>
  ): Promise<
    TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion
  > => {
    const chatRequest = Chat.toChatRequest<TStream>(request);
    return this.create<TStream>(chatRequest);
  };
}
