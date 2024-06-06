import { Requester } from './http';
import {
  ChatRequest,
  ChatCompletion,
  PromptRequest,
  ChatCompletionMessage,
  StreamParameter,
  StreamEnabled,
  StreamDisabled,
  ChatCompletionChunk
} from './types';

export class Chat {
  private http: Requester;

  constructor(http: Requester) {
    this.http = http;
  }

  private static toChatRequest<TStream extends StreamParameter>(req: PromptRequest<TStream>): ChatRequest<TStream> {

    const messages: ChatCompletionMessage[] = [];
    messages.push({ role: "system", content: req.system });
    messages.push({ role: "user", content: req.user });

    const chatReq: ChatRequest<any> = { ...req, messages };
    return chatReq;
  }

  create = async <TStream extends StreamParameter>(
    req: ChatRequest<TStream>
  ): Promise<TStream extends StreamEnabled ? ReadableStream<ChatCompletionChunk> : ChatCompletion> => {
    const body = JSON.stringify(req);

    if ("stream" in req && req.stream) {
      // @ts-ignore when req.stream, we return ChatCompletion
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
    req: PromptRequest<TStream>
  ): Promise<TStream extends StreamEnabled ? ReadableStream<ChatCompletionChunk> : ChatCompletion> => {
    const chatReq = Chat.toChatRequest<TStream>(req);
    return this.create<TStream>(chatReq);
  }
}
