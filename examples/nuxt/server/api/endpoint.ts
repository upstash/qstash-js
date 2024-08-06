import { verifySignatureNuxt } from "@upstash/qstash/nuxt";

export default verifySignatureNuxt(async (event) => {
  // simulate work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("Success");
  return { name: "John Doe", payload: readBody(event) };
});