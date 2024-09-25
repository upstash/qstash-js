import { NextRequest, NextResponse } from "next/server";

import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { serve } from "@upstash/qstash/nextjs";

export const GET = async (request: NextRequest) => {
  return new NextResponse("what", { status: 200 })
}

export const POST = serve(async (context) => {
  const result = await generateText({
    model: openai('gpt-3.5-turbo'),
    maxTokens: 512,
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        parameters: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => context.run("temparature tool", () => {
          return {
            location,
            temparature: 72 + Math.floor(Math.random() * 21) - 10,
          }
        })
      }),
      cityAttractions: tool({
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }: { city: string }) => context.run("attractions tool", () => {
          if (city === 'San Francisco') {
            return {
              attractions: [
                'Golden Gate Bridge',
                'Alcatraz Island',
                "Fisherman's Wharf",
              ],
            };
          } else {
            return { attractions: [
              "other things"
            ] };
          }
        })
      }),
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  // typed tool calls:
  for (const toolCall of result.toolCalls) {
    switch (toolCall.toolName) {
      case 'cityAttractions': {
        toolCall.args.city; // string
        break;
      }

      case 'weather': {
        toolCall.args.location; // string
        break;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
})