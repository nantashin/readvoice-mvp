import { NextRequest } from "next/server"
import { getLLM } from "@/lib/llm"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

const SYSTEM_PROMPT = `당신은 시각장애인과 거동불편인을 위한 AI 음성 도우미입니다.
답변은 반드시 짧고 명확하게 음성으로 읽기 쉽게 작성하세요.
마크다운, 특수기호, 별표, 샵 기호는 절대 사용하지 마세요.
숫자 목록은 반드시 "일번, 이번, 삼번, 사번" 형식으로 작성하세요.
항상 한국어로 답변하세요.

모든 답변 끝에 반드시 아래 형식으로 다음 행동을 안내하세요:

원하시는 서비스를 말씀해 주세요.
일번. 웹에서 검색하기
이번. 사진이나 문서 읽어드리기
삼번. 근처 복지관 및 지원 기관 안내
사번. 처음으로 돌아가기

관련 기관 연락처나 공식 사이트가 있으면 정확한 것만 포함하세요.
없으면 언급하지 마세요. 절대 추측하거나 만들어내지 마세요.`

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
