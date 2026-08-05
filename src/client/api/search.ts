import { BaseProvider } from "./base";
import type { ProviderInfo, SearchOwner } from "./types";

export class SearchProvider extends BaseProvider<"search", SearchOwner> {
  public readonly apiKind = "search";
  public readonly indexName: string;
  public readonly method = "POST";

  constructor(baseUrl: string, token: string, owner: SearchOwner, indexName: string) {
    super(baseUrl, token, owner);
    this.indexName = indexName;
  }

  getRoute(): string[] {
    return ["upsert-data", this.indexName];
  }

  getHeaders(_options: unknown): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
    };
  }

  onFinish(providerInfo: ProviderInfo, _options: unknown): ProviderInfo {
    return providerInfo;
  }
}

export const search = ({
  apiUrl,
  token,
  indexName,
}: {
  apiUrl: string;
  token: string;
  indexName: string;
}): SearchProvider => {
  return new SearchProvider(apiUrl, token, "search", indexName);
};
