import { NextRequest, NextResponse } from "next/server";
import { PublishPayload } from "./types";
import { Client } from "@upstash/qstash";

const client = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export const POST = async (request: NextRequest) => {

  try {
    const { url } = await request.json() as PublishPayload
    const { messageId } = await client.publishJSON({
      url,
      body: "Hello world!",
      method: "GET"
    })
  
    return new NextResponse(JSON.stringify({
      success: true,
      messageId,
    }), { status: 200 })
  } catch (error) {
    return new NextResponse(JSON.stringify({
      success: false,
      message: error
    }))
  }
}