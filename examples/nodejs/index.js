const { Client } = require("@upstash/qstash");
require("isomorphic-fetch");

async function main() {
  const q = new Client({
    baseUrl: "http:localhost:8000",
    authorization:
      "eyJVc2VySUQiOiI3ZjBlNGY0ZS1lNGM5LTQ3M2MtOThjYi1mNmEwZjcxZTdmNGUiLCJQYXNzd29yZCI6IjM1M2EzYzQ2LTAwNjYtNDM5Ni1hM2UwLWJlOGUyYzFmMjdmZCJ9",
  });

  const res = await q.publish({
    destination: "https://qstash-local.requestcatcher.com/",
    body: "Hello World",
  });
  console.log(res);
}

main();
