import Anthropic from "@anthropic-ai/sdk"
import * as http from "http"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
const OLLAMA_TIMEOUT = 30000 // 30초

type VisionModel = "moondream" | "llama-vision-q4" | "claude-haiku"

function isValidApiKey(key: string | undefined): boolean {
  if (!key) return false
  if (key === "your-key-here" || key === "your-anthropic-key-here") {
    return false
  }
  return key.length > 20
}

function isComplexImage(text: string): boolean {
  const complexKeywords = ["도표", "표", "차트", "그래프", "데이터 시각화", "복잡한", "여러 요소"]
  return complexKeywords.some(keyword => text.includes(keyword))
}

async function tryOllamaVision(
  buffer: Buffer,
  fileName: string,
  model: "moondream" | "llama3.2-vision:11b-instruct-q4_K_M"
): Promise<string | null> {
  try {
    const modelName = model === "moondream" ? "Moondream" : "Llama Vision Q4"
    console.log(`[OCR] Attempting Ollama ${modelName}...`)
    const base64Image = buffer.toString("base64")
    const prompt = `이 이미지를 시각장애인에게 설명해줘. 형식: '이것은 ${fileName}이라는 제목의 이미지로, [상세 묘사]입니다.' 한국어로 음성 읽기 쉽게.`

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout after ${OLLAMA_TIMEOUT}ms`))
      }, OLLAMA_TIMEOUT)

      const options = {
        hostname: "localhost",
        port: 11434,
        path: "/api/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }

      const req = http.request(options, (res) => {
        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          clearTimeout(timeout)
          try {
            const lines = data.split("\n").filter(line => line.trim())
            let fullResponse = ""
            for (const line of lines) {
              try {
                const json = JSON.parse(line)
                if (json.response) {
                  fullResponse += json.response
                }
              } catch {
                // 파싱 실패한 라인은 건너뜀
              }
            }
            const text = fullResponse.trim()
            if (!text) throw new Error("Empty response")
            console.log(`[OCR] ✓ Ollama ${modelName} succeeded`)
            resolve(text)
          } catch (error) {
            reject(error)
          }
        })
      })

      req.on("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      const payload = {
        model: model,
        prompt: prompt,
        images: [base64Image],
        stream: true,
      }

      req.write(JSON.stringify(payload))
      req.end()
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const modelName = model === "moondream" ? "Moondream" : "Llama Vision Q4"
    console.error(`[OCR] ✗ Ollama ${modelName} failed: ${errorMsg}`)
    return null
  }
}

async function tryClaudeHaiku(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  try {
    console.log("[OCR] Attempting Claude Haiku...")
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: `이 이미지를 시각장애인에게 설명해줘. 형식: '이것은 ${fileName}이라는 제목의 이미지로, [상세 묘사]입니다.' 한국어로 음성 읽기 쉽게.`,
            },
          ],
        },
      ],
    })
    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : ""
    if (!text) throw new Error("Empty response")
    console.log("[OCR] ✓ Claude Haiku succeeded")
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] ✗ Claude Haiku failed: ${errorMsg}`)
    return null
  }
}

async function tryClaudeSonnet(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  try {
    console.log("[OCR] Attempting Claude Sonnet...")
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: `이 이미지를 시각장애인에게 설명해줘. 형식: '이것은 ${fileName}이라는 제목의 이미지로, [상세 묘사]입니다.' 한국어로 음성 읽기 쉽게.`,
            },
          ],
        },
      ],
    })
    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : ""
    if (!text) throw new Error("Empty response")
    console.log("[OCR] ✓ Claude Sonnet succeeded")
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] ✗ Claude Sonnet failed: ${errorMsg}`)
    return null
  }
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string = "이미지",
  preferredModel: VisionModel = "moondream"
): Promise<string> {
  console.log(`[OCR] Using model preference: ${preferredModel}`)
  console.log(`[OCR] Ollama base URL: ${OLLAMA_BASE_URL}`)
  console.log(`[OCR] Timeout: ${OLLAMA_TIMEOUT}ms`)

  if (!isValidApiKey(process.env.ANTHROPIC_API_KEY)) {
    console.warn("[OCR] ⚠ ANTHROPIC_API_KEY is not set or invalid. Claude models will be skipped.")
  }

  const cleanFileName = fileName.replace(/\.[^/.]+$/, "") || "이미지"

  // 우선순위에 따라 시도
  let result: string | null = null

  if (preferredModel === "moondream" || preferredModel === "claude-haiku") {
    // Moondream 먼저 시도
    result = await tryOllamaVision(buffer, cleanFileName, "moondream")
    if (result) {
      if (isComplexImage(result)) {
        console.log("[OCR] Detected complex image, retrying with Llama Vision Q4...")
        const llavaResult = await tryOllamaVision(buffer, cleanFileName, "llama3.2-vision:11b-instruct-q4_K_M")
        if (llavaResult) return llavaResult
      }
      return result
    }

    // Llama Vision Q4 시도
    result = await tryOllamaVision(buffer, cleanFileName, "llama3.2-vision:11b-instruct-q4_K_M")
    if (result) {
      if (isComplexImage(result)) {
        console.log("[OCR] Detected complex image, retrying with Claude Sonnet...")
        const sonnetResult = await tryClaudeSonnet(buffer, mimeType, cleanFileName)
        if (sonnetResult) return sonnetResult
      }
      return result
    }

    // Claude Haiku fallback
    result = await tryClaudeHaiku(buffer, mimeType, cleanFileName)
    if (result) {
      if (isComplexImage(result)) {
        const sonnetResult = await tryClaudeSonnet(buffer, mimeType, cleanFileName)
        if (sonnetResult) return sonnetResult
      }
      return result
    }
  }

  // Claude Sonnet 최후의 수단
  result = await tryClaudeSonnet(buffer, mimeType, cleanFileName)
  if (result) return result

  throw new Error("모든 이미지 분석 서비스를 사용할 수 없습니다. Ollama가 실행 중인지 확인하세요.")
}
