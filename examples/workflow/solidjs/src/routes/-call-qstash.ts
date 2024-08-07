import { Client } from "@upstash/qstash";
import type { APIEvent, APIHandler } from "@solidjs/start/server";

const client = new Client({ baseUrl: process.env.QSTASH_URL!, token: process.env.QSTASH_TOKEN! });

export const POST: APIHandler = async (event: APIEvent) => {
  try {
    const { baseUrl, route, payload } = await event.request.json();
    
    const { messageId } = await client.publishJSON({
      url: `${baseUrl}/${route}`,
      body: payload
    });

    return new Response(JSON.stringify({ messageId }), { status: 200 });
  } catch (error) {
    return new Response(`Error when publishing to QStash: ${error}`, { status: 500 });
  }
};
