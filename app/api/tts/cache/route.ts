import { spawn } from 'child_process'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

const CACHE_PHRASES = [
  "안녕하세요, 무엇을 도와드릴까요?",
  "다시 말씀해 주세요",
  "잠깐만요, 분석 중이에요",
  "완료됐어요",
  "오랫동안 조용하셨네요. 계속 사용하시려면 말씀해 주세요."
]

const VOICES: Record<string, string> = {
  'sun-hi': 'ko-KR-SunHiNeural',
  'in-joon': 'ko-KR-InJoonNeural'
}

async function generateTTS(text: string, voiceName: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 한글 인코딩 문제 해결: 임시 파일로 저장
    const tmpFile = path.join(tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`)
    fs.writeFileSync(tmpFile, text, 'utf8')

    const edgeTTS = spawn('edge-tts', [
      '--file', tmpFile,
      '--voice', voiceName,
      '--rate=-5%',
      '--pitch=+5Hz',
      '--write-media', outputPath
    ], { shell: true })

    edgeTTS.stderr.on('data', (data) => {
      console.error('[Cache] edge-tts stderr:', data.toString())
    })

    edgeTTS.on('close', (code) => {
      // 임시 파일 삭제
      try {
        fs.unlinkSync(tmpFile)
      } catch (e) {
        console.error('[Cache] 임시 파일 삭제 실패:', e)
      }

      if (code === 0) {
        console.log(`[Cache] 생성: ${path.basename(outputPath)}`)
        resolve()
      } else {
        console.error(`[Cache] edge-tts failed with code ${code}`)
        reject(new Error(`edge-tts failed with code ${code}`))
      }
    })

    edgeTTS.on('error', (err) => {
      // 에러 시에도 임시 파일 삭제
      try {
        fs.unlinkSync(tmpFile)
      } catch (e) {
        console.error('[Cache] 임시 파일 삭제 실패:', e)
      }
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

    const voices = ['sun-hi', 'in-joon']
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
          console.error(`[Cache] 실패 (스킵): ${fileName}`, err)
          // throw 제거 - 개별 실패 시에도 다음 파일 계속 처리
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
