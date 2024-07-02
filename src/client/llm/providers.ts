export type ProviderReturnType = {
  owner: "upstash" | "openai" | "custom";
  baseUrl: string;
  llmToken: string;
};

const upstash = (): {
  owner: "upstash";
  baseUrl: "https://qstash.upstash.io";
  llmToken: string;
} => {
  if (!process.env.QSTASH_TOKEN) throw new Error("QSTASH_TOKEN cannot be empty or undefined!");
  return {
    owner: "upstash",
    baseUrl: "https://qstash.upstash.io",
    llmToken: process.env.QSTASH_TOKEN,
  };
};

const openai = ({
  llmToken,
}: {
  llmToken: string;
}): { owner: "openai"; baseUrl: "https://api.openai.com"; llmToken: string } => {
  return { llmToken, owner: "openai", baseUrl: "https://api.openai.com" };
};

const custom = ({
  baseUrl,
  llmToken,
}: {
  llmToken: string;
  baseUrl: string;
}): { owner: "custom"; baseUrl: string; llmToken: string } => {
  return { llmToken, owner: "custom", baseUrl };
};

export { custom, openai, upstash };
