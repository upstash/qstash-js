export type ProviderReturnType = {
  owner: "upstash" | "openai" | "custom";
  baseUrl: string;
  token: string;
};

export const analyticsBaseUrlMap = (
  analyticsName: "helicone",
  analyticsToken: string,
  providerApiKey: string,
  providerBaseUrl: string
) => {
  return {
    helicone: {
      baseURL: "https://gateway.helicone.ai/v1/chat/completions",
      headers: {
        "Helicone-Auth": `Bearer ${analyticsToken}`,
        "Helicone-Target-Url": providerBaseUrl,
        Authorization: `Bearer ${providerApiKey}`,
      },
    },
  }[analyticsName];
};

const upstash = (): {
  owner: "upstash";
  baseUrl: "https://qstash.upstash.io/llm";
  token: string;
} => {
  return {
    owner: "upstash",
    baseUrl: "https://qstash.upstash.io/llm",
    token: "",
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
