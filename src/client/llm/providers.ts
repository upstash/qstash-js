export type ProviderReturnType = {
  owner: "upstash" | "openai" | "custom";
  baseUrl: string;
  token: string;
};

const upstash = (): {
  owner: "upstash";
  baseUrl: "https://qstash.upstash.io/llm";
  token: string;
} => {
  if (!process.env.QSTASH_TOKEN) throw new Error("QSTASH_TOKEN cannot be empty or undefined!");
  return {
    owner: "upstash",
    baseUrl: "https://qstash.upstash.io/llm",
    token: process.env.QSTASH_TOKEN,
  };
};

const openai = ({
  token,
}: {
  token: string;
}): { owner: "openai"; baseUrl: "https://api.openai.com"; token: string } => {
  return { token: token, owner: "openai", baseUrl: "https://api.openai.com" };
};

const custom = ({
  baseUrl,
  token,
}: {
  token: string;
  baseUrl: string;
}): { owner: "custom"; baseUrl: string; token: string } => {
  const trimmedBaseUrl = baseUrl.replace(/\/(v1\/)?chat\/completions$/, ""); // Will trim /v1/chat/completions and /chat/completions
  return {
    token,
    owner: "custom",
    baseUrl: trimmedBaseUrl,
  };
};
export { custom, openai, upstash };
