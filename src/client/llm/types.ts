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

export type TogetherAIChatModel =
  | "zero-one-ai/Yi-34B-Chat"
  | "allenai/OLMo-7B-Instruct"
  | "allenai/OLMo-7B-Twin-2T"
  | "allenai/OLMo-7B"
  | "Austism/chronos-hermes-13b"
  | "cognitivecomputations/dolphin-2.5-mixtral-8x7b"
  | "databricks/dbrx-instruct"
  | "deepseek-ai/deepseek-coder-33b-instruct"
  | "deepseek-ai/deepseek-llm-67b-chat"
  | "garage-bAInd/Platypus2-70B-instruct"
  | "google/gemma-2b-it"
  | "google/gemma-7b-it"
  | "Gryphe/MythoMax-L2-13b"
  | "lmsys/vicuna-13b-v1.5"
  | "lmsys/vicuna-7b-v1.5"
  | "codellama/CodeLlama-13b-Instruct-hf"
  | "codellama/CodeLlama-34b-Instruct-hf"
  | "codellama/CodeLlama-70b-Instruct-hf"
  | "codellama/CodeLlama-7b-Instruct-hf"
  | "meta-llama/Llama-2-70b-chat-hf"
  | "meta-llama/Llama-2-13b-chat-hf"
  | "meta-llama/Llama-2-7b-chat-hf"
  | "meta-llama/Llama-3-8b-chat-hf"
  | "meta-llama/Llama-3-70b-chat-hf"
  | "mistralai/Mistral-7B-Instruct-v0.1"
  | "mistralai/Mistral-7B-Instruct-v0.2"
  | "mistralai/Mistral-7B-Instruct-v0.3"
  | "mistralai/Mixtral-8x7B-Instruct-v0.1"
  | "mistralai/Mixtral-8x22B-Instruct-v0.1"
  | "NousResearch/Nous-Capybara-7B-V1p9"
  | "NousResearch/Nous-Hermes-2-Mistral-7B-DPO"
  | "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO"
  | "NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT"
  | "NousResearch/Nous-Hermes-llama-2-7b"
  | "NousResearch/Nous-Hermes-Llama2-13b"
  | "NousResearch/Nous-Hermes-2-Yi-34B"
  | "openchat/openchat-3.5-1210"
  | "Open-Orca/Mistral-7B-OpenOrca"
  | "Qwen/Qwen1.5-0.5B-Chat"
  | "Qwen/Qwen1.5-1.8B-Chat"
  | "Qwen/Qwen1.5-4B-Chat"
  | "Qwen/Qwen1.5-7B-Chat"
  | "Qwen/Qwen1.5-14B-Chat"
  | "Qwen/Qwen1.5-32B-Chat"
  | "Qwen/Qwen1.5-72B-Chat"
  | "Qwen/Qwen1.5-110B-Chat"
  | "Qwen/Qwen2-72B-Instruct"
  | "snorkelai/Snorkel-Mistral-PairRM-DPO"
  | "Snowflake/snowflake-arctic-instruct"
  | "togethercomputer/alpaca-7b"
  | "teknium/OpenHermes-2-Mistral-7B"
  | "teknium/OpenHermes-2p5-Mistral-7B"
  | "togethercomputer/Llama-2-7B-32K-Instruct"
  | "togethercomputer/RedPajama-INCITE-Chat-3B-v1"
  | "togethercomputer/RedPajama-INCITE-7B-Chat"
  | "togethercomputer/StripedHyena-Nous-7B"
  | "Undi95/ReMM-SLERP-L2-13B"
  | "Undi95/Toppy-M-7B"
  | "WizardLM/WizardLM-13B-V1.2"
  | "upstage/SOLAR-10.7B-Instruct-v1.0";

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

export type LlmProvider = "openai" | "togetherai";
export type LlmProviderBaseUrl = "https://api.openai.com" | "https://api.together.xyz";

type ChatRequestProviders =
  | {
      provider: "openai";
      model: OpenAIChatModel;
      llmToken: string;
    }
  | {
      provider: "togetherai";
      model: TogetherAIChatModel;
      llmToken: string;
    }
  | { provider: "upstash"; model: ChatModel };

export type PromptChatRequest<TStream extends StreamParameter> = ChatRequestProviders &
  PromptChatRequestFields &
  TStream;

export type ChatRequest<TStream extends StreamParameter> = ChatRequestProviders &
  ChatRequestFields &
  TStream;
