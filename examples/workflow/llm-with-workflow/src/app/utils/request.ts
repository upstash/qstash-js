
type FetchParameters = {
  url: string,
  method: "POST",
  body: object,
  headers: Record<string, string>
}

export const getFetchParameters = (prompt: string): FetchParameters | undefined => {

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
        image_request: {
          model: "V_2",
          prompt,
          aspect_ratio: "ASPECT_1_1",
          magic_prompt_option: "AUTO"
        }
      },
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.IDEOGRAM_API_KEY
      }
    }
  } else {
    console.warn("No credential env var is set. Using placeholder.");
    return
  }
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