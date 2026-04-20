import { NextRequest } from "next/server"
import { getLLM } from "@/lib/llm"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

const SYSTEM_PROMPT = `당신은 시각장애인과 거동불편인을 위한 AI 음성 도우미 READ VOICE Pro입니다.
답변은 음성으로 읽기 쉽게 짧고 명확하게 작성하세요.
불필요한 기호나 마크다운은 사용하지 마세요.
항상 한국어로 답변하세요.`

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      return new Response("Invalid content type", { status: 415 })
    }

    const { message, history = [] } = await req.json()
    if (!message || typeof message !== "string") {
      return new Response("No message", { status: 400 })
    }
    if (message.length > 1000) {
      return new Response("Message too long", { status: 400 })
    }

    const llm = getLLM()
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...history.map((h: { role: string; content: string }) =>
        h.role === "user" ? new HumanMessage(h.content) : new SystemMessage(h.content)
      ),
      new HumanMessage(message),
    ]

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        try {
          const response = await llm.stream(messages)
          for await (const chunk of response) {
            const text = typeof chunk.content === "string" ? chunk.content : ""
            if (text) controller.enqueue(enc.encode(text))
          }
        } catch (e) {
          controller.enqueue(enc.encode("죄송합니다. 오류가 발생했습니다."))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch {
    return new Response("Server error", { status: 500 })
  }
}
