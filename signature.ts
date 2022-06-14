import { Client } from "./client.ts";
import { Consumer } from "./consumer.ts";

import { ed25519, encoding } from "./deps.ts";
// const q = new Client({
//   baseUrl: "http://localhost:8000",
//   authorization:
//     "eyJVc2VySUQiOiI3ZjBlNGY0ZS1lNGM5LTQ3M2MtOThjYi1mNmEwZjcxZTdmNGUiLCJQYXNzd29yZCI6IjM1M2EzYzQ2LTAwNjYtNDM5Ni1hM2UwLWJlOGUyYzFmMjdmZCJ9",
// });

// // console.log(await q.topics.create({ name: "test" }));
// // console.log(
// //   await q.endpoints.create({
// //     url: "https://qstash-local.requestcatcher.com/",
// //     topicName: "test",
// //   }),
// // );

// const res = await q.publish({
//   destination: "test",
//   body: "Hello World",
// });

// console.log(res);
const pk = "LTYjuFUcpz1jIEXMExj/YYJpZ1Qjgz7+E7r7M4LJj8I=";
const sk =
  "Ij9JLFmp5nefZ3B/fHlTUQ4ixf6viEDCy2aLd/B4PhstNiO4VRynPWMgRcwTGP9hgmlnVCODPv4TuvszgsmPwg==";
const signature =
  "z1P1QA3qVeihyTzkW9jZkCZeXZEPkdm9NOa06idfTIUeMGlgqI19snpvV41rQJFBPu+lzfKPO8+bLBi+dvHFCQ==";

const valid = await ed25519.verify(
  encoding.base64.decode(signature),
  new TextEncoder().encode("Hello"),
  encoding.base64.decode(pk),
);
console.log(valid);
