import { Client } from "@upstash/qstash";
import { NextRequest } from 'next/server';

const client = new Client({ baseUrl: process.env.QSTASH_URL!, token: process.env.QSTASH_TOKEN! });

export const POST = async (request: NextRequest) => {
  const { route, payload } = await request.json() as {baseUrl: string, route: string, payload: unknown};

  try {
    const {messageId} = await client.publishJSON({
      url: `${process.env.WORKFLOW_LOCAL_TUNNEL_URL}/${route}`,
      body: payload
    });

    return new Response(JSON.stringify({messageId}), {status: 200})
  } catch (error) {
    return new Response(JSON.stringify({error: `Error when publishing to QStash: ${error}`}), {status: 500})
  }
}
