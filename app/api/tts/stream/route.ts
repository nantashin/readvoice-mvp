import { spawn } from 'child_process'
import { NextRequest } from 'next/server'

const VOICES: Record<string, string> = {
  'sun-hi': 'ko-KR-SunHiNeural',
  'yu-jin': 'ko-KR-YuJinNeural',
  'hyunsu': 'ko-KR-HyunsuNeural'
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice, rate } = await req.json()

    if (!text || typeof text !== 'string') {
      return new Response('Invalid text', { status: 400 })
    }

    const voiceName = VOICES[voice] || VOICES['sun-hi']
    const finalRate = rate || 0.95

    // SSML 생성 (끝음 올리기, 서울 억양)
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
  <voice name="${voiceName}">
    <prosody pitch="+5%" rate="${finalRate}">
      ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </prosody>
  </voice>
</speak>`

    console.log(`[Edge TTS] 생성 시작: voice=${voice}, rate=${finalRate}`)

    // edge-tts 스트리밍 호출
    return new Promise<Response>((resolve, reject) => {
      const chunks: Buffer[] = []

      const edgeTTS = spawn('edge-tts', [
        '--text', text,
        '--voice', voiceName,
        `--rate=${Math.round((finalRate - 1) * 100)}%`,
        '--pitch=+5Hz',
        '--write-media', '-'
      ], { shell: true })

      edgeTTS.stdout.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
      })

      edgeTTS.stderr.on('data', (data) => {
        console.error('[Edge TTS] stderr:', data.toString())
      })

      edgeTTS.on('close', (code) => {
        if (code === 0) {
          const audioBuffer = Buffer.concat(chunks)
          console.log(`[Edge TTS] 생성 완료: ${audioBuffer.length} bytes`)

          resolve(new Response(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.length.toString()
            }
          }))
        } else {
          console.error(`[Edge TTS] 실패: exit code ${code}`)
          reject(new Error(`edge-tts failed with code ${code}`))
        }
      })

      edgeTTS.on('error', (err) => {
        console.error('[Edge TTS] spawn 에러:', err)
        reject(err)
      })
    })
  } catch (e) {
    console.error('[Edge TTS] API 에러:', e)
    return new Response('TTS generation failed', { status: 500 })
  }
}
