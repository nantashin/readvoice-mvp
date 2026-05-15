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
    const chunks: Buffer[] = []

    const edgeTTS = spawn('edge-tts', [
      '--text', text,
      '--voice', voiceName,
      '--rate', '-5%',
      '--pitch', '+5Hz',
      '--write-media', '-'
    ])

    edgeTTS.stdout.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk))
    })

    edgeTTS.on('close', (code) => {
      if (code === 0) {
        const audioBuffer = Buffer.concat(chunks)
        fs.writeFileSync(outputPath, audioBuffer)
        console.log(`[Cache] 생성: ${path.basename(outputPath)}`)
        resolve()
      } else {
        reject(new Error(`edge-tts failed with code ${code}`))
      }
    })

    edgeTTS.on('error', reject)
  })
}

export async function POST() {
  try {
    const cacheDir = path.join(process.cwd(), 'public', 'tts-cache')

    // 캐시 디렉토리 생성
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
      console.log('[Cache] 디렉토리 생성:', cacheDir)
    }

    const voices = ['sun-hi', 'yu-jin', 'hyunsu']
    let generated = 0

    for (const voice of voices) {
      const voiceName = VOICES[voice]

      for (const phrase of CACHE_PHRASES) {
        const hash = createHash('md5').update(phrase).digest('hex').slice(0, 8)
        const fileName = `${voice}_${hash}.mp3`
        const filePath = path.join(cacheDir, fileName)

        // 이미 존재하면 스킵
        if (fs.existsSync(filePath)) {
          continue
        }

        // TTS 생성
        await generateTTS(phrase, voiceName, filePath)
        generated++
      }
    }

    console.log(`[Cache] 완료: ${generated}개 파일 생성`)

    return Response.json({
      success: true,
      generated,
      message: `${generated}개 캐시 파일 생성 완료`
    })
  } catch (e) {
    console.error('[Cache] 에러:', e)
    return Response.json({ error: 'Cache generation failed' }, { status: 500 })
  }
}
