import { BaseProvider } from "./base";
import type { EmailOwner, ProviderInfo } from "./types";

export class EmailProvider extends BaseProvider<"email", EmailOwner> {
  public readonly apiKind = "email";
  public readonly batch: boolean;

  constructor(baseUrl: string, token: string, owner: EmailOwner, batch: boolean) {
    super(baseUrl, token, owner);
    this.batch = batch;
  }

  getRoute(): string[] {
    return this.batch ? ["emails", "batch"] : ["emails"];
  }
  getHeaders(): Record<string, string> {
    return {
      "upstash-forward-authorization": `Bearer ${this.token}`,
    };
  }

  onFinish(providerInfo: ProviderInfo, _options: unknown): ProviderInfo {
    return providerInfo;
  }
}

export const resend = ({
  token,
  batch = false,
}: {
  token: string;
  batch?: boolean;
}): EmailProvider => {
  return new EmailProvider("https://api.resend.com", token, "resend", batch);
};
