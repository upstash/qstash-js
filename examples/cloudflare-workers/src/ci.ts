/**
 * Entry point used in qstash-js CI tests
 */

import { Client } from "@upstash/qstash"
import { CRON, DESTINATION } from "./constants";

export type Env = {
  QSTASH_TOKEN: string
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.QSTASH_TOKEN) {
      throw new Error("CI test failed. QSTASH_TOKEN is missing.")
    }

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
}
