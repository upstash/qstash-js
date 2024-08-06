import { verifySignatureSvelte } from "@upstash/qstash/svelte";
import { env } from '$env/dynamic/private'

export const POST = verifySignatureSvelte(
  async ({request}) => {
    // simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Success");
    return new Response(
      JSON.stringify({ name: "John Doe", payload: await request.json()}),
      {status: 200}
    );
  },
  {
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY!,
  }
)