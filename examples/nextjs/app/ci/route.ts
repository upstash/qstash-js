import { Client } from "@upstash/qstash"
import { CRON, DESTINATION } from "./constants";

export const GET = async () => {
  if (!process.env.QSTASH_TOKEN) {
    throw new Error("CI test failed. QSTASH_TOKEN is missing.")
  }

  // create schedule
  const client = new Client({ token: process.env.QSTASH_TOKEN! })
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