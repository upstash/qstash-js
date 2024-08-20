import { Client } from "@upstash/qstash";
import type { H3Event } from "h3";
import { defineEventHandler, readBody } from "h3";

const client = new Client({ baseUrl: process.env.QSTASH_URL!, token: process.env.QSTASH_TOKEN! });

export default defineEventHandler(async (event: H3Event) => {
  const { baseUrl, route, payload } = await readBody(event) as { baseUrl: string, route: string, payload: unknown };

  try {
    const { messageId } = await client.publishJSON({
      url: `${baseUrl}/api/${route}`,
      body: payload,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ messageId }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `Error when publishing to QStash: ${error}`,
    };
  }
});
