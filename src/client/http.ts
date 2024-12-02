/* eslint-disable @typescript-eslint/no-magic-numbers */
import {
  QstashError,
  QstashRatelimitError,
  QstashChatRatelimitError,
  QstashDailyRatelimitError,
  RATELIMIT_STATUS,
} from "./error";
import type { BodyInit, HeadersInit, HTTPMethods, RequestOptions } from "./types";
import type { ChatCompletionChunk } from "./llm/types";

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
  method?: HTTPMethods;

  query?: Record<string, string | number | boolean | undefined>;

  /**
   * if enabled, call `res.json()`
   *
   * @default true
   */
  parseResponseAsJson?: boolean;
  /**
   * optionally overwrite the baseUrl of the http.
   *
   * default value of the http is base qstash url.
   */
  baseUrl?: string;
};
export type UpstashResponse<TResult> = TResult & { error?: string };

export type Requester = {
  request: <TResult = unknown>(request: UpstashRequest) => Promise<UpstashResponse<TResult>>;
  requestStream: (request: UpstashRequest) => AsyncIterable<ChatCompletionChunk>;
};

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
      /**
       * A backoff function receives the current retry cound and returns a number in milliseconds to wait before retrying.
       *
       * Applied when the response has 429 status, indicating a ratelimit.
       *
       * Initial `lastBackoff` value is 0.
       *
       * @default
       * ```ts
       * ((lastBackoff) => Math.max(lastBackoff, Math.random() * 4000) + 1000),
       * ```
       */
      ratelimitBackoff?: (lastBackoff: number) => number;
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
    ratelimitBackoff: (lastBackoff: number) => number;
  };

  public constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");

    this.authorization = config.authorization;

    this.retry =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      typeof config.retry === "boolean" && !config.retry
        ? {
            attempts: 1,
            backoff: () => 0,
            ratelimitBackoff: () => 0,
          }
        : {
            attempts: config.retry?.retries ?? 5,
            backoff: config.retry?.backoff ?? ((retryCount) => Math.exp(retryCount) * 50),
            ratelimitBackoff:
              config.retry?.ratelimitBackoff ??
              ((lastBackoff) => Math.max(lastBackoff, Math.random() * 4000) + 1000),
          };
  }

  public async request<TResult>(request: UpstashRequest): Promise<UpstashResponse<TResult>> {
    const { response } = await this.requestWithBackoff(request);
    if (request.parseResponseAsJson === false) {
      return undefined as unknown as UpstashResponse<TResult>;
    }
    return (await response.json()) as UpstashResponse<TResult>;
  }

  public async *requestStream(request: UpstashRequest): AsyncIterable<ChatCompletionChunk> {
    const { response } = await this.requestWithBackoff(request);

    if (!response.body) {
      throw new Error("No response body");
    }

    const body: ReadableStream<Uint8Array> = response.body;
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // stops here when max token reached
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        const chunks = chunkText.split("\n").filter(Boolean);

        for (const chunk of chunks) {
          if (chunk.startsWith("data: ")) {
            const data = chunk.slice(6);

            if (data === "[DONE]") {
              // stops here last message is delivered
              break;
            }

            yield JSON.parse(data);
          }
        }
      }
    } finally {
      await reader.cancel();
    }
  }

  private requestWithBackoff = async (
    request: UpstashRequest
  ): Promise<{
    response: Response;
    error: Error | undefined;
  }> => {
    const [url, requestOptions] = this.processRequest(request);

    let response: Response | undefined = undefined;
    let error: Error | undefined = undefined;
    let ratelimitBackoff = 0;
    for (let index = 0; index <= this.retry.attempts; index++) {
      try {
        response = await fetch(url.toString(), requestOptions);
        await this.checkResponse(response);
        break;
      } catch (error_) {
        error = error_ as Error;

        if (index < this.retry.attempts) {
          // Only sleep if this is not the last attempt

          if (error instanceof QstashError && error.status === RATELIMIT_STATUS) {
            ratelimitBackoff = this.retry.ratelimitBackoff(index);
            console.warn(
              `QStash Ratelimit Exceeded. Retrying after ${ratelimitBackoff} milliseconds. ${error.message}`
            );
            await new Promise((r) => setTimeout(r, ratelimitBackoff));
          } else {
            await new Promise((r) => setTimeout(r, this.retry.backoff(index)));
          }
        }
      }
    }
    if (!response) {
      throw error ?? new Error("Exhausted all retries");
    }

    return {
      response,
      error,
    };
  };

  private processRequest = (request: UpstashRequest): [string, RequestOptions] => {
    //@ts-expect-error caused by undici and bunjs type overlap
    const headers = new Headers(request.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", this.authorization);
    }
    const requestOptions: RequestOptions = {
      method: request.method,
      headers,
      body: request.body,
      keepalive: request.keepalive,
    };

    const url = new URL([request.baseUrl ?? this.baseUrl, ...request.path].join("/"));
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value.toString());
        }
      }
    }
    return [url.toString(), requestOptions];
  };

  private async checkResponse(response: Response) {
    if (response.status === RATELIMIT_STATUS) {
      if (response.headers.get("x-ratelimit-limit-requests")) {
        throw new QstashChatRatelimitError({
          "limit-requests": response.headers.get("x-ratelimit-limit-requests"),
          "limit-tokens": response.headers.get("x-ratelimit-limit-tokens"),
          "remaining-requests": response.headers.get("x-ratelimit-remaining-requests"),
          "remaining-tokens": response.headers.get("x-ratelimit-remaining-tokens"),
          "reset-requests": response.headers.get("x-ratelimit-reset-requests"),
          "reset-tokens": response.headers.get("x-ratelimit-reset-tokens"),
        });
      } else if (response.headers.get("RateLimit-Limit")) {
        throw new QstashDailyRatelimitError({
          limit: response.headers.get("RateLimit-Limit"),
          remaining: response.headers.get("RateLimit-Remaining"),
          reset: response.headers.get("RateLimit-Reset"),
        });
      }

      throw new QstashRatelimitError({
        limit: response.headers.get("Burst-RateLimit-Limit"),
        remaining: response.headers.get("Burst-RateLimit-Remaining"),
        reset: response.headers.get("Burst-RateLimit-Reset"),
      });
    }

    if (response.status < 200 || response.status >= 300) {
      const body = await response.text();
      throw new QstashError(
        body.length > 0 ? body : `Error: status=${response.status}`,
        response.status
      );
    }
  }
}
