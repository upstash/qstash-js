import { describe, test } from "bun:test";
import { Client } from "../client";
import { MOCK_QSTASH_SERVER_URL, mockQStashServer } from "../workflow/test-utils";
import { nanoid } from "../utils";
import { search } from "./search";

describe("search", () => {
  const qstashToken = nanoid();
  const searchToken = nanoid();
  const apiUrl = "https://mock-search.upstash.io";
  const indexName = "movies";

  const globalHeader = "global-header";
  const globalHeaderOverwritten = "global-header-overwritten";
  const requestHeader = "request-header";

  const globalHeaderValue = nanoid();
  const overWrittenOldValue = nanoid();
  const overWrittenNewValue = nanoid();
  const requestHeaderValue = nanoid();

  const client = new Client({
    baseUrl: MOCK_QSTASH_SERVER_URL,
    token: qstashToken,
    headers: {
      [globalHeader]: globalHeaderValue,
      [globalHeaderOverwritten]: overWrittenOldValue,
    },
  });

  test("should use search upsert", async () => {
    await mockQStashServer({
      execute: async () => {
        await client.publishJSON({
          api: {
            name: "search",
            provider: search({ apiUrl, token: searchToken, indexName }),
          },
          body: [
            {
              id: "movie-1",
              content: {
                title: "Inception",
                description: "A thriller about dreams within dreams.",
              },
              metadata: { genre: "sci-fi", year: 2010 },
            },
            {
              id: "movie-2",
              content: {
                title: "The Godfather",
                description: "A story about a powerful Italian-American crime family.",
              },
              metadata: { genre: "crime", year: 1972 },
            },
            {
              id: "movie-3",
              content: {
                title: "The Dark Knight",
                description: "A tale of Batman's fight against the Joker.",
              },
              metadata: { genre: "action", year: 2008 },
            },
          ],
          headers: {
            "content-type": "application/json",
            [globalHeaderOverwritten]: overWrittenNewValue,
            [requestHeader]: requestHeaderValue,
          },
        });
      },
      responseFields: {
        body: { messageId: "msgId" },
        status: 200,
      },
      receivesRequest: {
        method: "POST",
        token: qstashToken,
        url: `http://localhost:8080/v2/publish/${apiUrl}/upsert-data`,
        body: [
          {
            id: "movie-1",
            content: {
              title: "Inception",
              description: "A thriller about dreams within dreams.",
            },
            metadata: { genre: "sci-fi", year: 2010 },
          },
          {
            id: "movie-2",
            content: {
              title: "The Godfather",
              description: "A story about a powerful Italian-American crime family.",
            },
            metadata: { genre: "crime", year: 1972 },
          },
          {
            id: "movie-3",
            content: {
              title: "The Dark Knight",
              description: "A tale of Batman's fight against the Joker.",
            },
            metadata: { genre: "action", year: 2008 },
          },
        ],
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${qstashToken}`,
          "upstash-forward-authorization": `Bearer ${searchToken}`,
          [`upstash-forward-${requestHeader}`]: requestHeaderValue,
          [`upstash-forward-${globalHeader}`]: globalHeaderValue,
          [`upstash-forward-${globalHeaderOverwritten}`]: overWrittenNewValue,
          "upstash-method": "POST",
        },
      },
    });
  });
});
