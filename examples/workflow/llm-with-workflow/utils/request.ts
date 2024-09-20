import { FetchParameters } from './types'

export const getFetchParameters = (
  prompt: string,
): FetchParameters | undefined => {
  if (process.env.OPENAI_API_KEY) {
    return {
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      body: {
        model: 'dall-e-2',
        prompt,
        n: 1,
        size: '512x512',
      },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  }

  if (process.env.IDEOGRAM_API_KEY) {
    return {
      url: 'https://api.ideogram.ai/generate',
      method: 'POST',
      body: {
        image_request: {
          model: 'V_2',
          prompt,
          aspect_ratio: 'ASPECT_1_1',
          magic_prompt_option: 'AUTO',
        },
      },
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.IDEOGRAM_API_KEY,
      },
    }
  }

  console.warn('No credential env var is set. Using placeholder.')
  return
}
