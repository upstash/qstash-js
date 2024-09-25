import { describe, test } from "bun:test";

describe("check token", () => {
  test("should print some chars of token", () => {
    const token = process.env.QSTASH_TOKEN ?? "no-token";
    if (token === "no-token") {
      throw new Error("missing token");
    }

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers, no-console
    console.log(`Section: '${token.slice(13, 19)}'`);
  });
});
