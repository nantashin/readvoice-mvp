import { NextRequest } from "next/server"
import { getLLM } from "@/lib/llm"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

const SYSTEM_PROMPT = `당신은 친절한 AI 음성 도우미입니다. 사용자의 질문에 간결하고 명확하게 한국어로 답해주세요. 답변은 듣기 좋게 자연스러운 구어체로 해주세요.

답변 규칙:
- 반드시 짧고 명확하게 음성으로 읽기 쉽게 작성
- 마크다운, 특수기호 절대 사용 금지
- 모든 번호는 일번/이번/삼번/사번/오번 형식
- 항상 한국어로 답변

사용자 음성 명령 처리:
- "이미지 업로드", "사진 업로드", "사진 읽어줘" → 이번 서비스 안내
- "PDF 업로드", "문서 읽어줘", "파일 읽어줘" → 이번 서비스 안내
- "검색", "찾아줘", "알려줘", "뭐야" → 일번 서비스 안내
- "복지관", "지원기관", "도움" → 사번 서비스 안내
- "처음", "돌아가기", "다시" → 오번 서비스 안내

모든 답변 끝에 반드시 아래 메뉴 안내:

무엇을 도와드릴까요?
일번. 웹 검색
이번. 사진이나 문서 읽어들이기
삼번. 메뉴 선택하기
사번. 근처 복지관 및 지원 기관 안내
오번. 처음으로 돌아가기

관련 기관 연락처는 정확한 것만 포함하고
없으면 절대 만들어내지 마세요.`

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
