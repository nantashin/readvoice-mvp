import { ChatOllama } from "@langchain/ollama"

export function getOllamaLLM() {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "exaone3.5:2.4b",
    temperature: 0.7,
  })
}
