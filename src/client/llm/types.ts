import type { LLMProvider } from "../api/llm";

export type ChatCompletionMessage = {
  role: "system" | "assistant" | "user";
  content: string;
};

type ChatModel = "meta-llama/Meta-Llama-3-8B-Instruct" | "mistralai/Mistral-7B-Instruct-v0.2";

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

export type StreamEnabled = { stream: true };
export type StreamDisabled = { stream: false } | object;
export type StreamParameter = StreamEnabled | StreamDisabled;

export type OpenAIChatModel =
  | "gpt-4-turbo"
  | "gpt-4-turbo-2024-04-09"
  | "gpt-4-0125-preview"
  | "gpt-4-turbo-preview"
  | "gpt-4-1106-preview"
  | "gpt-4-vision-preview"
  | "gpt-4"
  | "gpt-4-0314"
  | "gpt-4-0613"
  | "gpt-4-32k"
  | "gpt-4-32k-0314"
  | "gpt-4-32k-0613"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k"
  | "gpt-3.5-turbo-0301"
  | "gpt-3.5-turbo-0613"
  | "gpt-3.5-turbo-1106"
  | "gpt-3.5-turbo-0125"
  | "gpt-3.5-turbo-16k-0613";

type ChatRequestCommonFields = {
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
};

type PromptChatRequestFields = ChatRequestCommonFields & {
  system: string;
  user: string;
};

type ChatRequestFields = ChatRequestCommonFields & {
  messages: ChatCompletionMessage[];
};

type ChatRequestProviders =
  | {
      provider: LLMProvider<"openai">;
      model: OpenAIChatModel;
      analytics?: { name: "helicone"; token: string };
    }
  | {
      provider: LLMProvider<"custom">;
      model: string;
      analytics?: { name: "helicone"; token: string };
    }
  // not adding anthropic for client.chat intentionally.
  // users should use the official sdk. it will overcomplicate things b/c of baseUrl.
  // we can pass a baseUrl but the rest of the route is different from openai/upstash
  // | {
  //     provider: LLMProvider<"anthropic">;
  //     model: string;
  //     analytics?: { name: "helicone"; token: string };
  //   }
  | {
      provider: LLMProvider<"upstash">;
      model: ChatModel;
      analytics?: { name: "helicone"; token: string };
    };

export type PromptChatRequest<TStream extends StreamParameter> = ChatRequestProviders &
  PromptChatRequestFields &
  TStream;

export type ChatRequest<TStream extends StreamParameter> = ChatRequestProviders &
  ChatRequestFields &
  TStream;
