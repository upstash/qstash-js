import type { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";

import { Receiver } from "@upstash/qstash";
const receiver = new Receiver({
  currentSigningKey: process.env["QSTASH_CURRENT_SIGNING_KEY"]!,
  nextSigningKey: process.env["QSTASH_Next_SIGNING_KEY"]!,
});

export const handler = async (
  event: APIGatewayEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> => {
  const isValid = await receiver.verify({
    signature: event.headers["upstash-signature"]!,
    body: event.body!,
    url: `https://${event.requestContext.domainName}`,
  });

  console.log({ isValid });
  // Add your business logic here

  return {
    statusCode: 200,
    body: "OK",
  };
};
