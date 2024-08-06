import { Client } from "@upstash/qstash";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { env } from '$env/dynamic/private'

const client = new Client({
  baseUrl: env.QSTASH_URL!,
  token: env.QSTASH_TOKEN!
});

export const POST: RequestHandler = async ({ request }) => {
  const { baseUrl, route, payload } = await request.json() as { baseUrl: string, route: string, payload: unknown };

  try {
    const { messageId } = await client.publishJSON({
      url: `${baseUrl}/${route}`,
      body: payload
    });

    return json({ messageId }, { status: 200 });
  } catch (error) {
    return json({ error: `Error when publishing to QStash: ${error}` }, { status: 500 });
  }
};
