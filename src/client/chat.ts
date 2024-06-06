import type { Requester } from './http';
import type {
  ChatRequest,
  ChatCompletion,
  PromptRequest,
  ChatCompletionMessage,
  StreamParameter,
  StreamEnabled,
  ChatCompletionChunk
} from './types';

export class Chat {
  private http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  private static toChatRequest<TStream extends StreamParameter>(request: PromptRequest<TStream>): ChatRequest<TStream> {

    const messages: ChatCompletionMessage[] = [];
    messages.push({ role: "system", content: request.system }, { role: "user", content: request.user });

    // @ts-expect-error ts can't resolve the type
    const chatRequest: ChatRequest<TStream> = { ...request, messages };
    return chatRequest;
  }

  create = async <TStream extends StreamParameter>(
    request: ChatRequest<TStream>
  ): Promise<TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion> => {
    const body = JSON.stringify(request);

    if ("stream" in request && request.stream) {
      // @ts-expect-error when req.stream, we return ChatCompletion
      return this.http.requestStream({
          path: ["llm", "v1", "chat", "completions"],
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Connection": "keep-alive",
              "Accept": "text/event-stream",
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
  }

  prompt = async <TStream extends StreamParameter>(
    request: PromptRequest<TStream>
  ): Promise<TStream extends StreamEnabled ? AsyncIterable<ChatCompletionChunk> : ChatCompletion> => {
    const chatRequest = Chat.toChatRequest<TStream>(request);
    return this.create<TStream>(chatRequest);
  }
}
