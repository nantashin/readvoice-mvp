import { ChatAnthropic } from "@langchain/anthropic"

export function getClaudeLLM() {
  return new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-haiku-4-5",
    temperature: 0.7,
  })
}
