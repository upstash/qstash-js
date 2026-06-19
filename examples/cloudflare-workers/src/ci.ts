/**
 * Entry point used in qstash-js CI tests
 */

import { Client, Receiver } from "@upstash/qstash"
import { CRON, DESTINATION, VERIFY_BODY } from "./constants";

export type Env = {
  QSTASH_TOKEN: string
  // Only set in the deployed CI job, used by the /verify endpoint below.
  QSTASH_CURRENT_SIGNING_KEY?: string
  QSTASH_NEXT_SIGNING_KEY?: string
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.QSTASH_TOKEN) {
      throw new Error("CI test failed. QSTASH_TOKEN is missing.")
    }

    const url = new URL(request.url);

    // Publishes a message to this same worker's /verify endpoint and returns
    // the message id so the test can follow it in the message logs.
    if (url.pathname === "/publish") {
      return handlePublish(env, url.origin);
    }

    // Endpoint with a verifier: QStash delivers the signed message here and the
    // Receiver checks the signature. Returns 200 only when the signature is valid.
    if (url.pathname === "/verify") {
      return handleVerify(request, env);
    }

    return handleSchedule(env);
  }
}

async function handlePublish(env: Env, origin: string): Promise<Response> {
  const client = new Client({ token: env.QSTASH_TOKEN })
  const { messageId } = await client.publishJSON({
    url: `${origin}/verify`,
    body: VERIFY_BODY,
  });
  return new Response(JSON.stringify({ messageId }), { status: 200 });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    return new Response("signing keys are missing", { status: 500 });
  }

  const signature = request.headers.get("Upstash-Signature");
  if (!signature) {
    return new Response("missing Upstash-Signature header", { status: 401 });
  }

  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

  const body = await request.text();
  try {
    await receiver.verify({ signature, body });
  } catch (error) {
    return new Response(`invalid signature: ${(error as Error).message}`, { status: 401 });
  }

  return new Response("OK", { status: 200 });
}

async function handleSchedule(env: Env): Promise<Response> {
  // create schedule
  const client = new Client({ token: env.QSTASH_TOKEN })
  const { scheduleId } = await client.schedules.create({
    destination: DESTINATION,
    cron: CRON,
  });

  // check schedule
  const schedule = await client.schedules.get(scheduleId)
  if (schedule.destination !== DESTINATION) throw new Error(
    `incorrect destionation. expected ${DESTINATION}, got ${schedule.destination}`
  )
  if (schedule.cron !== CRON) throw new Error(
    `incorrect cron. expected ${CRON}, got ${schedule.cron}`
  )

  // delete schedule
  await client.schedules.delete(scheduleId)
  return new Response(JSON.stringify(schedule), { status: 200 });
}
