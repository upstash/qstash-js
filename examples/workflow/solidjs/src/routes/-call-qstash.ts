import { Client } from "@upstash/qstash";
import type { APIEvent, APIHandler } from "@solidjs/start/server";

const client = new Client({ baseUrl: process.env.QSTASH_URL!, token: process.env.QSTASH_TOKEN! });

export const POST: APIHandler = async (event: APIEvent) => {
  try {
    const { route, payload } = await event.request.json();
    console.log(`${process.env.WORKFLOW_LOCAL_TUNNEL_URL}/${route}`);
    
    const { messageId } = await client.publishJSON({
      url: `${process.env.WORKFLOW_LOCAL_TUNNEL_URL}/${route}`,
      body: payload
    });

    return new Response(JSON.stringify({ messageId }), { status: 200 });
  } catch (error) {
    return new Response(`Error when publishing to QStash: ${error}`, { status: 500 });
  }
};
