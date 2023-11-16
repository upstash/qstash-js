import { QstashError, QstashRatelimitError } from "./error";

export type UpstashRequest = {
  /**
   * The path to the resource.
   */
  path: string[];

  /**
   * A BodyInit object or null to set request's body.
   */
  body?: BodyInit | null;

  /**
   * A Headers object, an object literal, or an array of two-item arrays to set
   * request's headers.
   */
  headers?: HeadersInit;

  /**
   * A boolean to set request's keepalive.
   */
  keepalive?: boolean;

  /**
   * A string to set request's method.
   */
  method?: "GET" | "POST" | "PUT" | "DELETE";

  query?: Record<string, string | number | boolean | undefined>;

  /**
   * if enabled, call `res.json()`
   *
   * @default true
   */
  parseResponseAsJson?: boolean;
};
export type UpstashResponse<TResult> = TResult & { error?: string };

export interface Requester {
  request: <TResult = unknown>(req: UpstashRequest) => Promise<UpstashResponse<TResult>>;
}

export type RetryConfig =
  | false
  | {
      /**
       * The number of retries to attempt before giving up.
       *
       * @default 5
       */
      retries?: number;
      /**
       * A backoff function receives the current retry cound and returns a number in milliseconds to wait before retrying.
       *
       * @default
       * ```ts
       * Math.exp(retryCount) * 50
       * ```
       */
      backoff?: (retryCount: number) => number;
    };

export type HttpClientConfig = {
  baseUrl: string;
  authorization: string;
  retry?: RetryConfig;
};

export class HttpClient implements Requester {
  public readonly baseUrl: string;

  public readonly authorization: string;

  public readonly options?: { backend?: string };

  public retry: {
    attempts: number;
    backoff: (retryCount: number) => number;
  };

  public constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");

    this.authorization = config.authorization;

    if (typeof config?.retry === "boolean" && config?.retry === false) {
      this.retry = {
        attempts: 1,
        backoff: () => 0,
      };
    } else {
      this.retry = {
        attempts: config.retry?.retries ? config.retry.retries + 1 : 5,
        backoff: config.retry?.backoff ?? ((retryCount) => Math.exp(retryCount) * 50),
      };
    }
  }

  public async request<TResult>(req: UpstashRequest): Promise<UpstashResponse<TResult>> {
    const headers = new Headers(req.headers);
    headers.set("Authorization", this.authorization);

    const requestOptions: RequestInit & { backend?: string } = {
      method: req.method,
      headers,
      body: req.body,
      keepalive: req.keepalive,
    };

    const url = new URL([this.baseUrl, ...(req.path ?? [])].join("/"));
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value !== "undefined") {
          url.searchParams.set(key, value.toString());
        }
      }
    }

    let res: Response | null = null;
    let error: Error | null = null;
    for (let i = 0; i < this.retry.attempts; i++) {
      try {
        res = await fetch(url.toString(), requestOptions);
        break;
      } catch (err) {
        error = err as Error;
        await new Promise((r) => setTimeout(r, this.retry.backoff(i)));
      }
    }
    if (!res) {
      throw error ?? new Error("Exhausted all retries");
    }
    if (res.status === 429) {
      throw new QstashRatelimitError({
        limit: res.headers.get("Burst-RateLimit-Limit"),
        remaining: res.headers.get("Burst-RateLimit-Remaining"),
        reset: res.headers.get("Burst-RateLimit-Reset"),
      });
    }

    if (res.status < 200 || res.status >= 300) {
      const body = await res.text();
      throw new QstashError(body.length > 0 ? body : `Error: status=${res.status}`);
    }
    if (req.parseResponseAsJson === false) {
      return undefined as unknown as UpstashResponse<TResult>;
    } else {
      return (await res.json()) as UpstashResponse<TResult>;
    }
  }
}
