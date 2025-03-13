import { Client } from "@upstash/qstash";


const client = new Client({ token: process.env.QSTASH_TOKEN! });
const queue = client.queue({
  queueName: "kauflandSellerApiQueue",
});
await queue.enqueueJSON({
  url: "https://testing-url-error.requestcatcher.com",
  body: {
    nextRefreshCycleCount: 80_000,
  },
  headers: { "Content-Type": "application/json" },
});
