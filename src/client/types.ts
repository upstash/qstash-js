export type State = "CREATED" | "ACTIVE" | "DELIVERED" | "ERROR" | "RETRY" | "FAILED";

export type Event = {
  time: number;
  state: State;
  messageId: string;
  nextDeliveryTime?: number;
  error?: string;
  url: string;
  topicName?: string;
  endpointName?: string;
};

export type WithCursor<T> = T & { cursor?: number };

export type BodyInit = Blob | FormData | URLSearchParams | ReadableStream<Uint8Array> | string;
export type HeadersInit =
  | Headers
  | Record<string, string>
  | [string, string][]
  | IterableIterator<[string, string]>;

export type RequestOptions = RequestInit & { backend?: string };

/**
 * Chat Types
 */

export type ChatCompletionMessage = {
  role: "system" | "assistant" | "user";
  content: string;
};

type ChatModel = 
  | "meta-llama/Meta-Llama-3-8B-Instruct" 
  | "mistralai/Mistral-7B-Instruct-v0.2";

type ChatResponseFormat = {
  type: "text" | "json_object";
};

type TopLogprob = {
  token: string;
  bytes: number[];
  logprob: number;
};

type ChatCompletionTokenLogprob = {
  token: string;
  bytes: number[];
  logprob: number;
  top_logprobs: TopLogprob[];
};

type ChoiceLogprobs = {
  content: ChatCompletionTokenLogprob[];
};

type Choice = {
  finish_reason: "stop" | "length";
  index: number;
  logprobs: ChoiceLogprobs;
  message: ChatCompletionMessage;
};

type CompletionUsage = {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
};

export type ChatCompletion = {
  id: string;
  choices: Choice[];
  created: number;
  model: string;
  object: "chat.completion";
  system_fingerprint: string;
  usage: CompletionUsage;
};

type ChunkChoice = {
  delta: ChatCompletionMessage;
  finish_reason: "stop" | "length";
  index: number;
  logprobs: ChoiceLogprobs;
};

export type ChatCompletionChunk = {
  id: string;
  choices: ChunkChoice[];
  created: number;
  model: string;
  object: "chat.completion.chunk";
  system_fingerprint: string;
  usage: CompletionUsage;
};

export type StreamEnabled = {stream: true}
export type StreamDisabled = {stream: false} | {}
export type StreamParameter = StreamEnabled | StreamDisabled

export type ChatRequest<TStream extends StreamParameter> = {
  messages: ChatCompletionMessage[];
  model: ChatModel;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  logprobs?: boolean;
  top_logprobs?: number;
  max_tokens?: number;
  n?: number;
  presence_penalty?: number;
  response_format?: ChatResponseFormat;
  seed?: number;
  stop?: string | string[];
  temperature?: number;
  top_p?: number;
} & TStream;

export type PromptRequest<TStream extends StreamParameter> = Omit<ChatRequest<TStream>, "messages" | "stream"> & {
  system: string;
  user: string;
} & TStream;
