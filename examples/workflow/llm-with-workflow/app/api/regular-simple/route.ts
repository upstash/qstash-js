import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'utils/types'

export const POST = async (request: NextRequest) => {
  // get prompt from request
  const params = await request.json()
  const prompt = params.prompt as string

  // make the fetch request
  const response = await fetch(
    "https://api.ideogram.ai/generate",
    {
      method: "POST",
      body: JSON.stringify({
        image_request: {
          model: 'V_2',
          prompt,
          aspect_ratio: 'ASPECT_1_1',
          magic_prompt_option: 'AUTO',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.IDEOGRAM_API_KEY!
      },
    }
  )

  // get the image url
  const payload = await response.json() as ImageResponse
  const url = payload.data[0].url

  return new NextResponse(
    JSON.stringify({ url }),
    { status: 200 }
  )
}