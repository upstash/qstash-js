import type { HTTPMethods } from "../types";
import type { ApiKind, Owner, ProviderInfo } from "./types";

export abstract class BaseProvider<TName extends ApiKind, TOwner = Owner> {
  public abstract readonly apiKind: TName;
  public abstract readonly method: HTTPMethods;

  public readonly baseUrl: string;
  public token: string;
  public readonly owner: TOwner;

  constructor(baseUrl: string, token: string, owner: TOwner) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.owner = owner;
  }

  /**
   * called before returning the final request
   *
   * @param request
   */
  abstract onFinish(request: ProviderInfo, options: unknown): ProviderInfo;

  abstract getRoute(): string[];

  abstract getHeaders(options: unknown): Record<string, string>;

  public getUrl(): string {
    return `${this.baseUrl}/${this.getRoute().join("/")}`;
  }
}
