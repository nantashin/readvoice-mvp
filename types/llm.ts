export interface LLMConfig {
  provider: 'ollama' | 'claude' | 'openai'
  model: string
  baseUrl?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}
