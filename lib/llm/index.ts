import { getOllamaLLM } from "./ollama"
import { getClaudeLLM } from "./claude"

export function getLLM() {
  const provider = process.env.LLM_PROVIDER || "ollama"
  switch (provider) {
    case "claude":
      return getClaudeLLM()
    case "ollama":
    default:
      return getOllamaLLM()
  }
}
