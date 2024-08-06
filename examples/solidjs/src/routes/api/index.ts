import { verifySignatureSolidjs } from "@upstash/qstash/solidjs";

export const POST = verifySignatureSolidjs(
  async (event) => {
    // simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("Success");
    return new Response(
      JSON.stringify({ name: "John Doe", payload: await event.request.json()}),
      {status: 200}
    );
  },
)