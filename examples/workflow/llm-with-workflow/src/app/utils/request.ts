
type FetchParameters = {
  url: string,
  method: "POST",
  body: object,
  headers: Record<string, string>
}

export const getFetchParameters = (prompt: string): FetchParameters => {

  if (process.env.OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/images/generations",
      method: "POST",
      body: {
        model: "dall-e-2",
        prompt,
        n: 1,
        size: "512x512"
      },
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  } else if (process.env.IDEOGRAM_API_KEY) {
    return {
      url: "https://api.ideogram.ai/generate",
      method: "POST",
      body: {
        model: "V_2",
        prompt,
        aspect_ratio: "ASPECT_1_1",
        magic_prompt_option: "AUTO"
      },
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.IDEOGRAM_API_KEY
      }
    }
  }
  
  throw new Error("Please configure the app to use OpenAI or Ideogram.")
}

type IdeogramResponse = {
  created: string,
  data: {
    prompt: string,
    url: string
  }[]
}

type OpenAIResponse = {
  created: number,
  data: {
    revised_prompt: string,
    url: string
  }[]
}

export type ImageResponse = IdeogramResponse | OpenAIResponse

export const getImageUrl = (response: ImageResponse) => {
  return response.data[0].url
}