import { NextRequest, NextResponse } from "next/server";

export const GET = async (request: NextRequest) => {
  return new NextResponse("returning GET result", {status: 200})
}

export const POST = async (request: NextRequest) => {
  const payload = await request.json()
  return new NextResponse(`returning POST result with payload: '${payload}'`, {status: 200})
}
