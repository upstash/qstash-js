import { Client } from "./client.ts";
const q = new Client({
  baseUrl: "http://localhost:8000",
  authorization:
    "eyJVc2VySUQiOiI3ZjBlNGY0ZS1lNGM5LTQ3M2MtOThjYi1mNmEwZjcxZTdmNGUiLCJQYXNzd29yZCI6IjM1M2EzYzQ2LTAwNjYtNDM5Ni1hM2UwLWJlOGUyYzFmMjdmZCJ9",
});

const topic = await q.topics.create({ name: crypto.randomUUID() });
const url = "https://qstash-local.requestcatcher.com/test";
const endpoint = await q.endpoints.create({ url, topicName: topic.name });

console.log({ endpoint });

// for (let i = 0; i <= 1000; i++) {
//   console.log(
//     i,
//     await q.publishJSON({
//       topic: topic.name,
//       cron: "* * * * *",
//       body: { hello: "world" },
//     }),
//   );
// }

let cursor = Date.now();
const logs: unknown[] = [];
while (cursor > 0) {
  console.log({ cursor });
  const res = await q.logs({ cursor });
  logs.push(...res.logs);
  cursor = res.cursor ?? 0;
}

console.log(logs);
