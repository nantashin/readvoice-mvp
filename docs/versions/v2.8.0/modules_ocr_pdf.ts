import fs from "fs"
import path from "path"
import os from "os"
import { execSync, spawnSync } from "child_process"
import { extractTextOCR } from "./ocr-engine"

// 모델별 타임아웃
const MODEL_TIMEOUTS: Record<string, number> = {
  "gemma4:e2b": 120000,       // 2분
  "gemma4:e4b": 180000,       // 3분
  "qwen3.5:9b": 600000,       // 10분
  "richardyoung/olmocr2:7b-q8": 180000,  // 3분
  "glm-ocr": 180000,          // 3분
  "llama3.2-vision:11b-instruct-q4_K_M": 600000,  // 10분
}

// 지원하는 Vision 모델 목록
const SUPPORTED_VISION_MODELS = [
  "gemma4:e2b",
  "gemma4:e4b",
  "llama3.2-vision:11b-instruct-q4_K_M",
  "qwen3.5:9b",
  "richardyoung/olmocr2:7b-q8",
  "glm-ocr"
]

/**
 * Tesseract 및 Vision LLM OCR 결과 후처리
 */
function postProcessOCR(text: string): string {
  return text
    // 특허 관련 오인식 교정
    .replace(/\bSHS\b/g, '특허')
    .replace(/\bSoS\b/g, '특허청')
    .replace(/\bsos\b/gi, '특허청')
    // URL/링크 패턴 보호 (숫자와 특수문자 혼합 → URL로 인식)
    .replace(/\d+\/\/[^\s]+/g, (match) => {
      // 숫자로 시작하는 가짜 URL → 실제 URL로 교정 시도
      return match.replace(/^1057/, 'https').replace(/\^/, '/')
    })
    // 전화번호 보호 (숫자-숫자 패턴)
    .replace(/(\d{3,4})-(\d{3,4})-?(\d{4})?/g, (m) => m)
    // 발명자 이름 사이 띄어쓰기 추가 (2자 이상 붙은 성명)
    .replace(/([가-힣]{2,3})([가-힣]{2,3})([가-힣]{2,3})/g, '$1 $2 $3')
    // DAS 코드 보호 (괄호 안 영문+숫자)
    .replace(/\(0246접근코드/g, '(DAS접근코드')
    // 특허청장 인식 강화
    .replace(/트\s*허\s*x\s*자|특\s*허\s*청\s*장/g, '특허청장')
}

function extractRawText(buffer: Buffer): string {
  const str = buffer.toString("binary")
  const matches = str.match(/\(([^\)]{2,100})\)/g) || []
  const texts = matches
    .map((m) => m.slice(1, -1))
    .filter((t) => {
      // 한글 또는 읽기 가능한 영문/숫자만
      const koreanCount = (t.match(/[가-힣]/g) || []).length
      const readableCount = (
        t.match(/[a-zA-Z0-9가-힣\s.,!?:;()]/g) || []
      ).length
      const totalCount = t.length
      // 읽기 가능한 문자 비율이 70% 이상이어야 함
      return (
        readableCount / totalCount > 0.7 &&
        (koreanCount > 0 || t.length > 3)
      )
    })
    .join(" ")
    .trim()

  return texts
}

/**
 * PDF에서 텍스트만 추출 (Vision 모델 사용 안 함)
 * 성공하면 텍스트 반환, 실패하면 null 반환
 */
export function extractTextOnly(buffer: Buffer, fileName?: string): string | null {
  const name = fileName || "문서"

  try {
    console.log("[PDF] 텍스트만 추출 시도...")
    const rawText = extractRawText(buffer)
    const koreanCount = (rawText.match(/[가-힣]/g) || []).length

    if (koreanCount > 10) {
      console.log(`[PDF] 텍스트 추출 성공: 한글 ${koreanCount}자`)
      return `파일명: ${name}\n\n설명:\n${rawText.substring(0, 4000)}`
    }

    console.log(`[PDF] 유효 텍스트 없음 (한글 ${koreanCount}자)`)
    return null
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] 텍스트 추출 실패:", message)
    return null
  }
}

export async function extractTextFromPDF(
  buffer: Buffer,
  fileName?: string,
  selectedModel?: string
): Promise<string> {
  const name = fileName || "문서"

  // 1단계: 간단한 텍스트 파싱
  try {
    console.log("[PDF] 텍스트 파싱 시도...")
    const rawText = extractRawText(buffer)
    // 한글이 최소 10자 이상 있어야 유효한 텍스트로 인정
    const koreanCount = (rawText.match(/[가-힣]/g) || []).length

    if (koreanCount > 10) {
      console.log(`[PDF] 텍스트 파싱 성공: 한글 ${koreanCount}자`)
      return `파일명: ${name}\n\n설명:\n${rawText.substring(0, 4000)}`
    }

    console.log(
      `[PDF] 유효 텍스트 없음 (한글 ${koreanCount}자) → pypdfium2로 전환`
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] 텍스트 파싱 실패:", message)
  }

  // 2단계: pypdfium2 Python 스크립트로 PDF → PNG 변환
  try {
    console.log("[PDF] pypdfium2로 PDF → PNG 변환...")

    const tmpDir = os.tmpdir()
    const tmpPdf = path.join(tmpDir, `rv_${Date.now()}.pdf`)

    fs.writeFileSync(tmpPdf, buffer)

    try {
      const PYTHON_BIN = process.env.PYTHON_BIN ||
        "C:\\Users\\tara0\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"
      console.log("[OCR] PYTHON_BIN:", PYTHON_BIN)

      const OLLAMA_PATH = "C:\\Users\\tara0\\AppData\\Local\\Programs\\Ollama"
      const env = {
        ...process.env,
        PATH: `${OLLAMA_PATH};${process.env.PATH}`,
        PYTHONIOENCODING: "utf-8",
        PYTHON_BIN
      }

      const scriptPath = path.join(process.cwd(), "server", "pdf-to-image.py")

      const result = spawnSync(PYTHON_BIN, [scriptPath, tmpPdf, "0"], {
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024, // 50MB 버퍼
        encoding: "utf8",
        env
      })

      if (result.error) throw result.error
      if (result.status !== 0) {
        console.error("[PDF] Python 오류:", result.stderr)
        throw new Error("pypdfium2 실행 실패")
      }

      const parsed = JSON.parse(result.stdout.trim())

      // 파일 삭제 - 약간 대기 후 삭제
      setTimeout(() => {
        try {
          fs.unlinkSync(tmpPdf)
        } catch (e) {}
      }, 1000)

      if (parsed.success && parsed.base64) {
        console.log(
          `[PDF] pypdfium2 변환 성공, ${parsed.total_pages}페이지`
        )
        const base64ImageOriginal = parsed.base64
        const pngBuffer = Buffer.from(base64ImageOriginal, "base64")

        const prefix =
          parsed.total_pages > 1
            ? `총 ${parsed.total_pages}페이지 문서입니다. 첫 페이지를 읽어드립니다.\n\n`
            : ""

        // Step 2: 화질 강화 파이프라인
        let tmpPngPath: string | null = null
        let enhancedPngPath: string | null = null
        let finalBase64Image = base64ImageOriginal
        let tesseractDraft = ""

        try {
          // 임시 PNG 파일 저장
          tmpPngPath = path.join(tmpDir, `rv_${Date.now()}.png`)
          fs.writeFileSync(tmpPngPath, pngBuffer)

          // pdf-enhance.py 실행
          const enhanceScript = path.join(process.cwd(), "server", "pdf-enhance.py")
          enhancedPngPath = tmpPngPath.replace(".png", "_enhanced.png")

          console.log("[PDF] 화질 강화 실행...")
          const enhanceResult = spawnSync(PYTHON_BIN, [enhanceScript, tmpPngPath, enhancedPngPath], {
            timeout: 30000,
            encoding: "utf8",
            env
          })

          if (enhanceResult.status === 0 && enhanceResult.stdout) {
            const enhanceData = JSON.parse(enhanceResult.stdout.trim())
            if (enhanceData.success && fs.existsSync(enhancedPngPath)) {
              console.log("[PDF] 화질 강화 성공:", enhanceData.enhanced ? "강화됨" : "원본 유지")
              const enhancedBuffer = fs.readFileSync(enhancedPngPath)
              finalBase64Image = enhancedBuffer.toString("base64")
            } else {
              console.log("[PDF] 화질 강화 실패, 원본 사용:", enhanceData.error || "알 수 없음")
              enhancedPngPath = tmpPngPath // fallback
            }
          } else {
            console.log("[PDF] 화질 강화 스크립트 오류, 원본 사용")
            enhancedPngPath = tmpPngPath // fallback
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.log("[PDF] 화질 강화 예외, 원본 사용:", msg)
          enhancedPngPath = tmpPngPath // fallback
        }

        // Step 3: Tesseract OCR로 초안 추출 (강화된 이미지 사용)
        try {
          const tesseractScript = path.join(process.cwd(), "server", "tesseract-ocr.py")
          const imageForOCR = enhancedPngPath || tmpPngPath || ""

          if (imageForOCR) {
            console.log("[PDF] Tesseract OCR 초안 추출...")
            const tesseractResult = spawnSync(PYTHON_BIN, [tesseractScript, imageForOCR], {
              timeout: 60000,
              encoding: "utf8",
              env
            })

            if (tesseractResult.status === 0 && tesseractResult.stdout) {
              const tesseractData = JSON.parse(tesseractResult.stdout.trim())
              if (tesseractData.success && tesseractData.text) {
                tesseractDraft = postProcessOCR(tesseractData.text)
                console.log(`[PDF] Tesseract 성공 (후처리 적용): ${tesseractData.length || tesseractDraft.length}자`)
              } else {
                console.log("[PDF] Tesseract 실패:", tesseractData.error || "빈 결과")
              }
            } else {
              console.log("[PDF] Tesseract 스크립트 오류")
            }
          } else {
            console.log("[PDF] Tesseract 건너뜀: 이미지 경로 없음")
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          console.log("[PDF] Tesseract 예외:", msg)
        }

        // Step 4: Vision 모델로 교정 (강화된 이미지 사용)
        if (!selectedModel || !SUPPORTED_VISION_MODELS.includes(selectedModel)) {
          throw new Error("지원하지 않는 모델입니다. gemma4:e2b, gemma4:e4b, llama3.2-vision, qwen3.5:9b, olmocr2, glm-ocr 중 선택해주세요.")
        }

        // Tesseract 결과에 따라 프롬프트 구성
        const OCR_PROMPT = tesseractDraft.length > 50
          ? `아래는 Tesseract OCR로 추출한 초안입니다. 다음 규칙으로 교정하세요:

1. 반드시 지킬 규칙:
   - 숫자는 절대 변경 금지 (출원번호, 전화번호, 날짜 등)
   - 영문+숫자 조합은 원본 그대로 유지 (예: 1-2024-0091199-09)
   - URL은 원본 그대로 유지 (www.로 시작하는 주소)
   - 괄호 안 내용은 원본 최대한 유지
   - "특허"가 "SHS"나 비슷한 오류로 보이면 "특허"로 교정
   - "특허청"이 "SoS"나 비슷한 오류로 보이면 "특허청"으로 교정

2. 교정 방법:
   - 한글 오인식만 교정 (문자 모양이 비슷해서 틀린 경우)
   - 띄어쓰기 추가 (이름 사이, 단어 사이)
   - 레이아웃 순서 유지 (위→아래, 왼쪽→오른쪽)

초안:
${tesseractDraft}

교정된 텍스트만 출력하세요:`
          : `이 문서의 모든 텍스트를 정확히 읽어서 한국어로 출력하세요.
숫자, URL, 영문코드는 원본 그대로 유지하세요.`

        console.log(`[PDF] OCR 프롬프트 타입: ${tesseractDraft.length > 50 ? "교정 모드" : "직접 읽기 모드"}`)
        console.log(`[PDF] Tesseract 초안 길이: ${tesseractDraft.length}자`)

        // Vision LLM 호출 함수 (재사용 가능)
        const callVisionModel = async (modelName: string): Promise<{ text: string | null; isTimeout: boolean }> => {
          const timeout = MODEL_TIMEOUTS[modelName] || 300000

          try {
            console.log(`[PDF] ${modelName}으로 OCR 실행... (타임아웃: ${timeout / 1000}초)`)
            const res = await fetch("http://localhost:11434/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: modelName,
                messages: [{
                  role: "user",
                  content: OCR_PROMPT,
                  images: [finalBase64Image]
                }],
                stream: false
              }),
              signal: AbortSignal.timeout(timeout)
            })

            if (!res.ok) {
              const errText = await res.text()
              console.error(`[PDF] ${modelName} HTTP 오류:`, res.status, errText)
              return { text: null, isTimeout: false }
            }

            const data = await res.json()
            console.log(`[PDF] ${modelName} 응답 데이터:`, JSON.stringify(data).substring(0, 200))

            const rawText = data.message?.content?.trim()
            const text = rawText ? postProcessOCR(rawText) : null

            if (text && text.length > 5) {
              console.log(`[PDF] ${modelName} OCR 성공 (후처리 적용), 텍스트 길이: ${text.length}자`)
              return { text, isTimeout: false }
            } else {
              console.log(`[PDF] ${modelName} 빈 응답 감지`)
              console.log(`  - data 전체:`, JSON.stringify(data))
              console.log(`  - message 존재:`, !!data.message)
              console.log(`  - content 값:`, data.message?.content)
              console.log(`  - content 타입:`, typeof data.message?.content)
              console.log(`  - content 길이:`, data.message?.content?.length)
              return { text: null, isTimeout: false }
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            const isTimeout = msg.toLowerCase().includes("timeout")
            console.error(`[PDF] ${modelName} OCR 실패:`, msg, `(타임아웃: ${isTimeout})`)
            return { text: null, isTimeout }
          }
        }

        // 사용자 선택 모델로만 시도 (fallback 없음)
        // 단, gemma4:e2b 타임아웃 시에만 gemma4:e4b로 자동 전환
        let finalText: string | null = null

        try {
          console.log(`[PDF] 사용자 선택 모델: ${selectedModel}`)
          const result = await callVisionModel(selectedModel)

          if (result.text) {
            console.log(`[PDF] ${selectedModel} 성공!`)
            return `파일명: ${name}\n\n${prefix}${result.text}`
          }

          // gemma4:e2b 타임아웃 시 gemma4:e4b로 자동 전환
          if (selectedModel === "gemma4:e2b" && result.isTimeout) {
            console.log(`[PDF] gemma4:e2b 타임아웃 → gemma4:e4b로 자동 전환`)
            const fallbackResult = await callVisionModel("gemma4:e4b")
            if (fallbackResult.text) {
              console.log(`[PDF] gemma4:e4b 성공!`)
              return `파일명: ${name}\n\n${prefix}${fallbackResult.text}`
            }
          }

          // 모델 실패 → Tesseract 결과라도 반환 (초안 문구 제거)
          if (tesseractDraft && tesseractDraft.length > 50) {
            console.log(`[PDF] ${selectedModel} 실패, Tesseract 결과 반환 (${tesseractDraft.length}자)`)
            return `파일명: ${name}\n\n${prefix}${tesseractDraft}`
          }

          return `${selectedModel} 모델이 문서를 읽지 못했어요. 다른 모델을 선택해 주세요.`
        } finally {
          // 임시 파일 정리
          setTimeout(() => {
            try {
              if (tmpPngPath && fs.existsSync(tmpPngPath)) fs.unlinkSync(tmpPngPath)
              if (enhancedPngPath && enhancedPngPath !== tmpPngPath && fs.existsSync(enhancedPngPath)) {
                fs.unlinkSync(enhancedPngPath)
              }
            } catch (e) {
              // 무시
            }
          }, 1000)
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("[PDF] pypdfium2 실패:", message)
      if (fs.existsSync(tmpPdf)) {
        try {
          fs.unlinkSync(tmpPdf)
        } catch (e) {}
      }
      throw e
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[PDF] PDF 변환 실패:", message)
    throw new Error(`PDF 변환 실패: ${message}`)
  }

  // 3단계: 모든 처리 실패
  throw new Error("PDF 처리 실패")
}
