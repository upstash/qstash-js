import { Schedule } from "@upstash/qstash";
import { test, expect } from "bun:test";
import { CRON, DESTINATION } from "./src/constants";

const deploymentURL = process.env.DEPLOYMENT_URL;
if (!deploymentURL) {
  throw new Error("DEPLOYMENT_URL not set");
}

test("the server is running", async () => {
  const res = await fetch(deploymentURL);
  if (res.status !== 200) {
    console.log(await res.text());
  }
  expect(res.status).toEqual(200);

  const schedule = await res.json() as Schedule
  expect(schedule.cron).toBe(CRON)
  expect(schedule.destination).toBe(DESTINATION)
});