import { verifySignatureH3 } from "@upstash/qstash/h3";

export default verifySignatureH3(async (event) => {
  // simulate work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("Success");
  return { name: "John Doe", payload: readBody(event) };
});