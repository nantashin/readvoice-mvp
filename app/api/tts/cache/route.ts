import { spawn } from 'child_process'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

const CACHE_PHRASES = [
  "안녕하세요, 무엇을 도와드릴까요?",
  "다시 말씀해 주세요",
  "잠깐만요, 분석 중이에요",
  "완료됐어요",
  "오랫동안 조용하셨네요. 계속 사용하시려면 말씀해 주세요."
]

const VOICES: Record<string, string> = {
  'sun-hi': 'ko-KR-SunHiNeural',
  'yu-jin': 'ko-KR-YuJinNeural',
  'hyunsu': 'ko-KR-HyunsuNeural'
}

async function generateTTS(text: string, voiceName: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const edgeTTS = spawn('edge-tts', [
      '--text', text,
      '--voice', voiceName,
      '--rate=-5%',
      '--pitch=+5Hz',
      '--write-media', outputPath
    ], { shell: true })

    edgeTTS.stderr.on('data', (data) => {
      console.error('[Cache] edge-tts stderr:', data.toString())
    })

    edgeTTS.on('close', (code) => {
      if (code === 0) {
        console.log(`[Cache] 생성: ${path.basename(outputPath)}`)
        resolve()
      } else {
        console.error(`[Cache] edge-tts failed with code ${code}`)
        reject(new Error(`edge-tts failed with code ${code}`))
      }
    })

    edgeTTS.on('error', (err) => {
      console.error('[Cache] spawn error:', err)
      reject(err)
    })
  })
}

export async function POST() {
  try {
    const cacheDir = path.join(process.cwd(), 'public', 'tts-cache')
    console.log('[Cache] 시작, 캐시 디렉토리:', cacheDir)

    // 캐시 디렉토리 생성
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
      console.log('[Cache] 디렉토리 생성:', cacheDir)
    }

    const voices = ['sun-hi', 'yu-jin', 'hyunsu']
    let generated = 0

    for (const voice of voices) {
      const voiceName = VOICES[voice]
      console.log(`[Cache] 음성 ${voice} (${voiceName}) 처리 중...`)

      for (const phrase of CACHE_PHRASES) {
        const hash = createHash('md5').update(phrase).digest('hex').slice(0, 8)
        const fileName = `${voice}_${hash}.mp3`
        const filePath = path.join(cacheDir, fileName)

        console.log(`[Cache] 파일 생성 중: ${fileName}`)
        console.log(`[Cache] 경로: ${filePath}`)

        // 이미 존재하면 스킵
        if (fs.existsSync(filePath)) {
          console.log(`[Cache] 스킵 (이미 존재): ${fileName}`)
          continue
        }

        // TTS 생성
        try {
          await generateTTS(phrase, voiceName, filePath)
          generated++
          console.log(`[Cache] 성공: ${fileName}`)
        } catch (err) {
          console.error(`[Cache] 실패: ${fileName}`, err)
          throw err
        }
      }
    }

    console.log(`[Cache] 완료: ${generated}개 파일 생성`)

    return Response.json({
      success: true,
      generated,
      message: `${generated}개 캐시 파일 생성 완료`
    })
  } catch (e) {
    console.error('[Cache] 최종 에러:', e)
    return Response.json({
      error: 'Cache generation failed',
      details: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
