import type { Requester } from "../http";
import { PROVIDER_MAP } from "./constants";
import type {
  ChatRequest,
  ChatCompletion,
  PromptChatRequest,
  ChatCompletionMessage,
  StreamParameter,
  StreamEnabled,
  ChatCompletionChunk,
} from "./types";

export class Chat {
  private http: Requester;

  constructor(http: Requester) {
    this.http = http;
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
    if (request.provider === "openai" || request.provider === "togetherai")
      return this.createThirdParty<TStream>(request);

    const body = JSON.stringify(request);

    if ("stream" in request && request.stream) {
      // @ts-expect-error when req.stream, we return ChatCompletion
      return this.http.requestStream({
        path: ["llm", "v1", "chat", "completions"],
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: body,
      });
    }

    return this.http.request({
      path: ["llm", "v1", "chat", "completions"],
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });
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
    if (request.provider === "openai" || request.provider === "togetherai") {
      const baseUrl = PROVIDER_MAP[request.provider];

      const llmToken = request.llmToken;
      //@ts-expect-error Gotta remove, otherwise openai throwsn an error
      delete request.llmToken;
      //@ts-expect-error Gotta remove, otherwise openai throwsn an error
      delete request.system;
      //@ts-expect-error Gotta remove, otherwise openai throwsn an error
      delete request.provider;

      const body = JSON.stringify(request);

      if ("stream" in request && request.stream) {
        // @ts-expect-error when req.stream, we return ChatCompletion
        return this.http.requestStream({
          path: ["v1", "chat", "completions"],
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Connection: "keep-alive",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            Authorization: `Bearer ${llmToken}`,
          },
          body,
          baseUrl,
        });
      }

      return this.http.request({
        path: ["v1", "chat", "completions"],
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmToken}`,
        },
        body,
        baseUrl,
      });
    }
    throw new Error("Could not find any third party provider");
  };

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
