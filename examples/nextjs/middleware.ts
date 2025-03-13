import { verifySignatureEdge } from "@upstash/qstash/nextjs";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

export default verifySignatureEdge(async (
  request: NextRequest,
  context?: NextFetchEvent,
): Promise<Response> => {
  return NextResponse.next()
})

export const config = {
  matcher: "/api/middleware-endpoint",
};