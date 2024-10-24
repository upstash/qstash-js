import type { PublishRequest } from "../client";

export const appendAPIOptions = (request: PublishRequest<unknown>, headers: Headers) => {
  if (request.api?.name === "email") {
    headers.set("Authorization", request.api.provider.token);
    request.method = request.method ?? "POST";
  }
};
