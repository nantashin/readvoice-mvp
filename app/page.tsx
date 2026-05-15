"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSpeechRecognition } from "@/lib/speech/stt"
import { useTTS } from "@/lib/speech/tts-provider"
import { cleanForTTS } from "@/lib/speech/tts"
import { parseSpeedCommand, saveSpeechRate, loadSpeechRate } from "@/lib/speech/speed-control"
import FileUpload, { IMAGE_MODELS, DOCUMENT_MODELS } from "@/app/components/FileUpload"
import MicButton from "@/app/components/MicButton"
import ResponseDisplay from "@/app/components/ResponseDisplay"
import { bgmManager } from "@/lib/audio/bgm-manager"
import { playMicOn, playMicOff } from "@/lib/audio/mic-sound"
import { sessionManager } from "@/lib/session/session-manager"

type MicState = "off" | "listening" | "processing" | "speaking"
type MenuState = "idle" | "main_menu" | "model_select" | "confirm" | "ocr" | "image" | "youtube_search" | "youtube_select" | "file_list" | "file_select" | "loading"
// 다국어 지원 예정: "language_select" 추가 가능
type FileType = "image" | "document" | null

interface UploadFile {
  name: string
  path: string
  modified: Date
}

const INTRO_TTS = `안녕하세요! AI 음성 도우미예요. 띠링 소리가 나면 말씀해 주세요.`

const MAIN_MENU_TTS = `어떻게 도와드릴까요?
일번. 무언가 검색해 드릴게요.
이번. 사진이나 이미지를 분석해 드릴게요.
삼번. 문서를 읽어드릴게요.
사번. 분석 모델을 바꿔드릴게요.
오번. 처음으로 돌아가요.
스페이스바를 누르고 번호나 원하시는 걸 말씀해 주세요.`

const IMAGE_MODEL_MENU_TTS = `기본 모델은 구글 4기가예요. 이미지 위주라면 구글 4기가, 큐쓰리, 구글 2기가, 라마비전 중에서 선택하세요. 텍스트 문서라면 구글 4기가, 큐쓰리, 구글 2기가, 라마비전, 올름오씨알 중에서 선택하세요. 어떤 모델로 읽어드릴까요?`

const DOCUMENT_MODEL_MENU_TTS = IMAGE_MODEL_MENU_TTS

const MODEL_MENU_TTS = IMAGE_MODEL_MENU_TTS

// 자연어 명령어 패턴
const VOICE_COMMANDS = {
  stop: /멈춰|그만|취소|중지|스톱/,
  repeat: /다시|반복|다시 읽어|다시 해줘/,
  home: /처음으로|처음 메뉴|메뉴|홈|처음|시작/,
  back: /이전|이전 거|이전 메뉴|뒤로|돌아가/,
  image: /이미지|사진|그림|이미지 읽어|사진 읽어|그림 읽어|이미지 업로드/,
  document: /문서|문서 읽어|OCR|글자 읽어|텍스트|파일 읽어|PDF/,
  changeModel: /다른 모델|모델 바꿔|다른 거|다른 걸로|젤 좋은 거|최고 모델|모델 선택/,
  quit: /꺼|종료|끝|닫아/,
  done: /이제 됐어|됐어|완료|고마워|감사해/,
  setDefaultModel: /기본|기본 모델|기본으로/,
  // 자연어 명령어 확장: 이미지 관련 키워드 + 액션 키워드
  imageKeywords: /사진|화면|그림|이미지|스크린|캡처|그래프|차트|도표/,
  actionKeywords: /읽어|분석|설명|알려|보여|해줘|해주세요|해봐|시작/,
}

export default function Home() {
  const [micState, setMicState] = useState<MicState>("off")
  const [menuState, setMenuState] = useState<MenuState>("idle")
  const [response, setResponse] = useState("")
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [speechRate, setSpeechRate] = useState<number>(1.0)
  const [selectedModel, setSelectedModel] = useState<string>("gemma4:e4b")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingAction, setPendingAction] = useState<string>("")
  // 다국어 지원 예정: const [selectedLanguage, setSelectedLanguage] = useState<string>("ko")
  const [lastResponse, setLastResponse] = useState<string>("")
  const [lastSpoken, setLastSpoken] = useState<string>("")
  const [previousMenuState, setPreviousMenuState] = useState<MenuState>("idle")
  const [fileType, setFileType] = useState<FileType>(null)
  const [youtubeResults, setYoutubeResults] = useState<{title:string,url:string}[]>([])
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [showYoutube, setShowYoutube] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [selectedFileName, setSelectedFileName] = useState<string>("")

  const micStateRef = useRef<MicState>("off")
  const menuStateRef = useRef<MenuState>("idle")
  const isWaitingSpeedChoiceRef = useRef<boolean>(false)
  const recommendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutMicTimerRef = useRef<NodeJS.Timeout | null>(null)

  const stt = useSpeechRecognition()
  const tts = useTTS()

  // 초기 설정
  useEffect(() => {
    setSpeechRate(loadSpeechRate())

    // 세션 시작
    sessionManager.startSession()

    // 업로드 폴더 자동 생성
    fetch("/api/watch-folder").catch(() => {
      console.log("[폴더 생성] 실패")
    })

    // TTS 사전 캐시 생성 (백그라운드)
    if (process.env.NEXT_PUBLIC_TTS_PROVIDER === 'edge') {
      fetch("/api/tts/cache", { method: "POST" }).then(() => {
        console.log("[TTS] 사전 캐시 생성 완료")
      }).catch((e) => {
        console.log("[TTS] 사전 캐시 생성 실패:", e)
      })
    }

    // 페이지 포커스 강제 설정
    document.body.focus()
    document.body.setAttribute("tabindex", "0")
    document.body.focus()

    // 첫 번째 사용자 인터랙션 시 안내 멘트 재생
    let hasPlayed = false

    const playIntro = () => {
      if (hasPlayed) return
      hasPlayed = true

      console.log("[초기화] 첫 인터랙션 감지, 안내 멘트 재생")
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(INTRO_TTS)
      utt.lang = "ko-KR"
      utt.rate = 1.0
      utt.pitch = 1.7
      utt.onend = () => {
        console.log("[TTS] 안내 멘트 끝남, 띠링 소리 재생")
        setTimeout(() => playMicOn(), 500)
      }
      window.speechSynthesis.speak(utt)

      // 이벤트 리스너 제거
      document.removeEventListener('click', playIntro)
      document.removeEventListener('keydown', playIntro)
      document.removeEventListener('touchstart', playIntro)
    }

    // 모든 사용자 인터랙션 감지 (스페이스바, 터치, 클릭)
    document.addEventListener('click', playIntro)
    document.addEventListener('keydown', playIntro)
    document.addEventListener('touchstart', playIntro)

    console.log("[초기화] 첫 인터랙션 대기 중 (스페이스바/터치/클릭)")

    return () => {
      document.removeEventListener('click', playIntro)
      document.removeEventListener('keydown', playIntro)
      document.removeEventListener('touchstart', playIntro)
    }
  }, [])

  useEffect(() => {
    micStateRef.current = micState
  }, [micState])

  useEffect(() => {
    // 이전 menuState 저장
    if (menuStateRef.current !== menuState) {
      setPreviousMenuState(menuStateRef.current)
    }
    menuStateRef.current = menuState
  }, [menuState])

  // 응답이 설정될 때 lastResponse도 저장
  useEffect(() => {
    if (response) {
      setLastResponse(response)
    }
  }, [response])

  const speak = useCallback((text: string, rate?: number, pitch: number = 1.7, onEnd?: () => void) => {
    // 기존 TTS 즉시 중단
    window.speechSynthesis.cancel()

    // 추천 타이머 즉시 취소 (새로운 speak 호출 시 기존 타이머 모두 제거)
    if (recommendTimerRef.current) {
      clearTimeout(recommendTimerRef.current)
      recommendTimerRef.current = null
    }

    // 마지막 멘트 저장 (다시 재생용)
    setLastSpoken(text)

    // TTS 전처리: 불릿/특수기호 제거, 마크다운 정리
    const cleanedText = cleanForTTS(text)
    const utt = new SpeechSynthesisUtterance(cleanedText)
    utt.lang = "ko-KR"
    utt.rate = rate || speechRate
    utt.pitch = pitch  // 솔 높이 (밝고 경쾌한 음성)
    if (onEnd) {
      utt.onend = onEnd
    }
    window.speechSynthesis.speak(utt)
  }, [speechRate])

  const startListening = useCallback(() => {
    speak("네, 말씀해 주세요.", speechRate, 1.7, () => {
      // TTS 완전히 끝난 후에만 마이크 ON
      setTimeout(() => {
        stt.startListening()
        setMicState("listening")
        playMicOn()  // 띠링~ 효과음
      }, 300)
    })
  }, [stt, speak, speechRate])

  const stopListening = useCallback(() => {
    stt.stopListening()
    setMicState("off")
    playMicOff()  // 띵동~ 효과음
  }, [stt])

  // imageSelected 이벤트 수신 (사진)
  useEffect(() => {
    const handleImageSelected = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("image")
      setSelectedModel("gemma4:e4b")  // 새 파일 = 모델 초기화
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("imageSelected", handleImageSelected as EventListener)
    return () => window.removeEventListener("imageSelected", handleImageSelected as EventListener)
  }, [startListening])

  // imageDocSelected, imageMixedSelected, classifyFailed 이벤트 핸들러 제거됨
  // 이유: FileUpload에서 classifyImage를 제거하고 /api/ocr에서만 8종 분류 수행

  // pdfScannedSelected 이벤트 수신
  useEffect(() => {
    const handlePdfScannedSelected = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("document")
      setSelectedModel("gemma4:e4b")  // 새 파일 = 모델 초기화
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("pdfScannedSelected", handlePdfScannedSelected as EventListener)
    return () => window.removeEventListener("pdfScannedSelected", handlePdfScannedSelected as EventListener)
  }, [startListening])

  // 세션 타임아웃 이벤트 리스너
  useEffect(() => {
    const handleSessionTimeout = (e: Event) => {
      const customEvent = e as CustomEvent
      const reason = customEvent.detail?.reason

      console.log("[세션] 타임아웃 감지:", reason)

      // 음성/BGM 중지
      window.speechSynthesis.cancel()
      bgmManager.pause()

      // 상태 초기화 (페이지 리로드 없음!)
      setResponse("")
      setPendingFile(null)
      setSelectedModel("gemma4:e4b")
      setMenuState("idle")
      setMicState("off")

      // 사용자에게 안내
      if (reason === 'timeout') {
        // 타임아웃: 부드러운 안내
        speak("오랫동안 조용하셨네요. 계속 사용하시려면 말씀해 주세요.", speechRate, 1.7, () => {
          setMenuState("main_menu")
          playMicOn()
          setTimeout(() => {
            stt.startListening()
            setMicState("listening")

            // 10초 후 자동 종료 타이머
            timeoutMicTimerRef.current = setTimeout(() => {
              console.log('[세션] 타임아웃 응답 없음, 마이크 자동 종료')
              stt.stopListening()
              setMicState("off")
              speak("응답이 없어서 마이크를 끕니다.", speechRate)
            }, 10000)
          }, 200)

          // 새 세션 시작
          sessionManager.startSession()
        })
      } else if (reason === 'user_request') {
        // 사용자 명시적 종료: 감사 인사 후 메인 메뉴
        setMenuState("main_menu")
        setTimeout(() => {
          sessionManager.startSession()
        }, 3000)
      } else {
        // 피드백 후 종료: 메인 메뉴로
        setMenuState("main_menu")
        setTimeout(() => {
          sessionManager.startSession()
        }, 2000)
      }
    }

    window.addEventListener('sessionTimeout', handleSessionTimeout)

    return () => {
      window.removeEventListener('sessionTimeout', handleSessionTimeout)
    }
  }, [speechRate, speak, stt])

  // 유튜브 재생 이벤트 처리
  useEffect(() => {
    const handleYoutube = (e: CustomEvent) => {
      setYoutubeUrl(e.detail.url)
      setShowYoutube(true)
    }
    window.addEventListener("playYoutube", handleYoutube as EventListener)
    return () => window.removeEventListener("playYoutube", handleYoutube as EventListener)
  }, [])

  // 모델 선택 10초 무응답 시 안내
  useEffect(() => {
    if (menuState !== "model_select") return

    const timer = setTimeout(() => {
      if (menuStateRef.current === "model_select") {
        speak("어떤 모델로 해드릴까요? 잘 모르시겠으면 '추천해줘'라고 말씀해 주세요.", speechRate)
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [menuState, speak, speechRate])

  // 싱글탭: 현재 동작 중지 + 마이크 ON
  // 스페이스바 이벤트: Push-to-Talk 방식
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()

        // TTS 재생 중이면 중지
        if (tts.isSpeaking) {
          tts.stop()
          console.log('[스페이스] TTS 중지')
          return
        }

        // 마이크 ON
        console.log('[스페이스] 마이크 ON (Push-to-Talk)')
        playMicOn()
        setTimeout(() => {
          stt.startListening()
          setMicState("listening")
        }, 200)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return

      if (e.code === "Space") {
        e.preventDefault()

        // 마이크 OFF
        if (micStateRef.current === "listening") {
          console.log('[스페이스] 마이크 OFF (Push-to-Talk)')
          playMicOff()
          stt.stopListening()
          setMicState("processing")
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [stt, tts])

  // STT 결과 처리
  useEffect(() => {
    if (!stt.isListening && stt.transcript && micStateRef.current === "listening") {
      const transcript = stt.transcript.trim()
      if (!transcript) return

      console.log("[STT] 결과:", transcript, "메뉴상태:", menuStateRef.current)
      setMicState("processing")
      handleVoiceResult(transcript)
    }
  }, [stt.isListening, stt.transcript])

  // 파일명으로 파일 로드
  const loadFileByName = async (fileName: string) => {
    console.log(`[loadFileByName] 시작: ${fileName}`)

    // 타이머 리셋
    sessionManager.resetTimer()

    // 이전 결과 초기화
    setResponse("")

    try {
      // 추천 타이머 취소
      if (recommendTimerRef.current) {
        clearTimeout(recommendTimerRef.current)
        recommendTimerRef.current = null
        console.log("[loadFileByName] 추천 타이머 취소됨")
      }

      speak(`${fileName.replace(/\.(jpg|jpeg|png|webp|pdf|txt|docx|doc|ppt|pptx)$/i, '')}를 선택했어요. 파일을 읽고 있어요.`, speechRate, 1.7, async () => {
        console.log("[loadFileByName] TTS 완료, 파일 읽기 시작")
        const res = await fetch(`/api/read-file?file=${encodeURIComponent(fileName)}`)
        const data = await res.json()

        if (data.error) {
          speak("파일을 읽을 수 없어요. 다시 시도해 주세요.", speechRate)
          return
        }

        // Base64 → Blob → File
        const base64Data = data.base64
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: data.mimeType })
        const file = new File([blob], fileName, { type: data.mimeType })

        setPendingFile(file)
        setSelectedFileName(fileName)
        setMenuState("model_select")

        // 모델 선택 안내
        speak(MODEL_MENU_TTS, speechRate, 1.7, () => {
          playMicOn()
          setTimeout(() => {
            stt.startListening()
            setMicState("listening")
          }, 200)
        })
      })
    } catch (e) {
      console.error("[loadFileByName] 에러:", e)
      speak("파일을 읽는 중 오류가 발생했어요.", speechRate)
    }
  }

  // 파일 분석 실행 헬퍼 함수
  const executeAnalysis = useCallback((file: File, modelId: string) => {
    console.log("[executeAnalysis] 파일:", file.name, "모델:", modelId)

    // 분석 시작 = 활동 (타이머 리셋)
    sessionManager.resetTimer()

    // 이전 분석 결과 초기화
    setResponse("")

    window.dispatchEvent(new CustomEvent("startAnalysis", { detail: { file, model: modelId } }))
    setPendingFile(null)
    setMicState("processing")
  }, [])

  const handleVoiceResult = async (transcript: string) => {
    const t = transcript.replace(/\s/g, "").toLowerCase()
    console.log("[음성] 입력:", transcript)
    console.log('[STT처리] 입력값:', t)

    // 타임아웃 마이크 타이머 클리어 (응답이 들어왔으면 취소)
    if (timeoutMicTimerRef.current) {
      clearTimeout(timeoutMicTimerRef.current)
      timeoutMicTimerRef.current = null
    }

    // 사용자 활동 감지 - 타이머 리셋
    sessionManager.resetTimer()

    // ── 전역 명령어: 멈춰 / 다시 ──────────────
    // 멈춰 - TTS/BGM 중단
    if (/멈춰|그만|취소|중지|스톱/.test(t)) {
      window.speechSynthesis.cancel()
      bgmManager.pause()
      speak("멈췄어요. 스페이스바를 누르고 말씀해 주세요.", speechRate)
      return
    }

    // 다시 - 마지막 멘트 재생
    if (/다시|반복|다시읽어|다시해줘/.test(t)) {
      if (lastSpoken) {
        speak(lastSpoken, speechRate)
      } else {
        speak("다시 들려드릴 내용이 없어요.", speechRate)
      }
      return
    }

    // ── 음성 선택 명령 ──────────────
    // 선희 (sun-hi) - 다양한 발음 포함
    if (/선희|선이|성이|전히|전희|선의|서니|밝은.?목소리|밝게/.test(t)) {
      console.log('[음성선택] 선희 명령 감지, transcript:', transcript)
      console.log('[음성선택] tts 객체:', tts)
      console.log('[음성선택] setSelectedVoice 존재:', 'setSelectedVoice' in tts)

      if ('setSelectedVoice' in tts) {
        console.log('[음성선택] 선희로 변경 중...')
        ;(tts as any).setSelectedVoice('sun-hi')
        localStorage.setItem('ttsVoice', 'sun-hi')
        console.log('[음성선택] speak 호출 직전')
        speak("선희 목소리로 바꿨어요", speechRate)
      } else {
        console.log('[음성선택] Edge TTS 아님, Web Speech API 사용 중')
        console.log('[음성선택] speak 호출 직전')
        speak("음성 변경은 Edge TTS에서만 지원됩니다", speechRate)
      }
      return
    }

    // 인준 (in-joon) - 남자 목소리
    if (/인준|인중|남자.?목소리|남성/.test(t)) {
      console.log('[음성선택] 인준 명령 감지, transcript:', transcript)
      console.log('[음성선택] tts 객체:', tts)
      console.log('[음성선택] setSelectedVoice 존재:', 'setSelectedVoice' in tts)

      if ('setSelectedVoice' in tts) {
        console.log('[음성선택] 인준으로 변경 중...')
        ;(tts as any).setSelectedVoice('in-joon')
        localStorage.setItem('ttsVoice', 'in-joon')
        speak("인준 목소리로 바꿨어요", speechRate)
      } else {
        console.log('[음성선택] Edge TTS 아님, Web Speech API 사용 중')
        speak("음성 변경은 Edge TTS에서만 지원됩니다", speechRate)
      }
      return
    }

    // ── 침묵 처리 (너무 짧거나 비어있음) ──────────────
    if (!transcript || transcript.trim().length < 2) {
      speak("이대로 진행할까요? 아니면 말씀해 주세요.", speechRate)
      return
    }

    // ── 유튜브 검색 모드 처리 ──────────────
    if (menuStateRef.current === "youtube_search") {
      const searchQuery = transcript
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `유튜브에서 "${searchQuery}" 검색 결과 음악 3개를 JSON으로 답해줘.
형식: [{"title":"곡 제목","url":"https://www.youtube.com/watch?v=..."}]
실제 존재하는 유튜브 URL만 답해줘. JSON만 답해.`,
            model: "exaone3.5:2.4b"
          })
        })
        const data = await res.json()
        const text = data.response || data.message || "[]"
        const results = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]")
        setYoutubeResults(results)

        const resultText = results.map((r: {title: string}, i: number) =>
          `${i+1}번. ${r.title}`
        ).join(". ")
        speak(`${resultText}. 몇 번을 틀어드릴까요?`, speechRate)
        setMenuState("youtube_select")
      } catch {
        const fallback = [
          { title: "잔잔한 피아노 음악", url: "https://www.youtube.com/watch?v=4oStw0r33so" },
          { title: "집중력 향상 음악", url: "https://www.youtube.com/watch?v=kH8fJHV2fIQ" },
          { title: "자연 소리 음악", url: "https://www.youtube.com/watch?v=lTRiuFIWV54" }
        ]
        setYoutubeResults(fallback)
        speak("일번. 잔잔한 피아노 음악. 이번. 집중력 향상 음악. 삼번. 자연 소리 음악. 몇 번을 틀어드릴까요?", speechRate)
        setMenuState("youtube_select")
      }
      return
    }

    // ── 유튜브 선택 모드 처리 ──────────────
    if (menuStateRef.current === "youtube_select") {
      const num = /일번|1번|1/.test(t) ? 0 : /이번|2번|2/.test(t) ? 1 : /삼번|3번|3/.test(t) ? 2 : -1
      if (num >= 0 && youtubeResults[num]) {
        bgmManager.playYoutube(youtubeResults[num].url)
        speak(`${youtubeResults[num].title} 틀어드릴게요.`, speechRate)
        setMenuState("idle")
      } else {
        speak("다시 말씀해 주세요. 일번, 이번, 또는 삼번이에요.", speechRate)
      }
      return
    }

    // ── 파일 선택 모드 처리 ──────────────
    if (menuStateRef.current === "file_select") {
      // 추천 타이머 즉시 취소
      if (recommendTimerRef.current) {
        clearTimeout(recommendTimerRef.current)
        recommendTimerRef.current = null
      }

      // 번호로 선택
      const numMatch = transcript.match(/일번|1번|이번|2번|삼번|3번|사번|4번|오번|5번/)
      if (numMatch) {
        const numMap: Record<string, number> = {
          "일번": 0, "1번": 0, "이번": 1, "2번": 1, "삼번": 2, "3번": 2,
          "사번": 3, "4번": 3, "오번": 4, "5번": 4
        }
        const num = numMap[numMatch[0]]
        if (uploadFiles[num]) {
          setMenuState("loading")  // 즉시 상태 변경
          loadFileByName(uploadFiles[num].name)
          return
        }
      }

      // 파일명으로 선택 (부분 매칭, 공백 무시)
      const normalizedInput = transcript.replace(/\s/g, '').toLowerCase()
      const matchedFile = uploadFiles.find(f => {
        const normalizedFileName = f.name.replace(/\s/g, '').toLowerCase()
        const normalizedFileNameNoExt = normalizedFileName.replace(/\.(jpg|jpeg|png|webp|pdf|txt|docx|doc|ppt|pptx)$/i, '')
        return normalizedFileName.includes(normalizedInput) ||
               normalizedFileNameNoExt.includes(normalizedInput) ||
               normalizedInput.includes(normalizedFileNameNoExt)
      })

      if (matchedFile) {
        console.log(`[파일 선택] 매칭: "${transcript}" → "${matchedFile.name}"`)
        setMenuState("loading")  // 즉시 상태 변경
        loadFileByName(matchedFile.name)
      } else {
        console.log(`[파일 선택] 매칭 실패: "${transcript}"`)
        speak("파일을 찾을 수 없어요. 다시 말씀해 주세요.", speechRate)
      }
      return
    }

    // ── 즉시 처리 키워드 (LLM 불필요) ──────────────

    // 추천해줘
    if (/추천|추천해|추천해줘|골라줘|알아서/.test(t)) {
      setSelectedModel("gemma4:e4b")
      speak("구글 4기가로 분석해 드릴게요.", speechRate, 1.7, () => {
        if (pendingFile) {
          executeAnalysis(pendingFile, "gemma4:e4b")
        } else {
          speak("이미지를 올려주세요.", speechRate, 1.7, () => {
            setTimeout(() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click(), 300)
          })
        }
      })
      return
    }

    // 속도
    if (/천천히|느리게|빠르잖아|못알아|빠르다|빨라/.test(t)) {
      const nr = Math.max(0.5, speechRate - 0.5)
      setSpeechRate(nr); saveSpeechRate(nr)
      speak(`${nr}배속이에요.`, nr)
      return
    }
    if (/빠르게|빨리|너무느려|쫌빨|좀빨/.test(t)) {
      const nr = Math.min(10.0, speechRate + 0.5)
      setSpeechRate(nr); saveSpeechRate(nr)
      speak(`${nr}배속이에요.`, nr)
      return
    }

    // 이미지 업로드 (가장 많이 쓰는 명령) - 바로 폴더 열기
    if (/이미지|사진|그림|화면|스크린/.test(t) &&
        /업로드|분석|읽어|열어|올려|봐줘|해줘|시작/.test(t)) {
      // 바로 폴더 파일 목록 가져오기
      speak("업로드 폴더를 확인하고 있어요.", speechRate, 1.7, () => {
        console.log("[파일 목록] TTS 완료, 폴더 열기 + API 호출 시작")

        // Windows 탐색기로 폴더 열기
        fetch("/api/open-folder", { method: "POST" })
          .then(() => console.log("[폴더] 열림"))
          .catch(e => console.error("[폴더] 열기 실패:", e))

        // 파일 목록 가져오기
        fetch("/api/watch-folder")
          .then(res => res.json())
          .then(data => {
            const files = data.files || []
            console.log("[파일 목록] 파일:", files.length, "개")

            if (files.length === 0) {
              speak("폴더에 파일이 없어요. 파일을 폴더에 넣어주세요.", speechRate)
              return
            }

            setUploadFiles(files)
            setMenuState("file_list")

            // 파일 목록 읽어주기
            const fileList = files.slice(0, 5).map((f: UploadFile, i: number) =>
              `${i + 1}번. ${f.name.replace(/\.(jpg|jpeg|png|webp|pdf)$/i, '')}`
            ).join(". ")

            const message = files.length > 5
              ? `${fileList}. 총 ${files.length}개 파일이 있어요. 파일 이름을 말씀해 주세요.`
              : `${fileList}. 파일 이름을 말씀해 주세요.`

            speak(message, speechRate, 1.7, () => {
              setMenuState("file_select")
              playMicOn()
              setTimeout(() => {
                stt.startListening()
                setMicState("listening")
              }, 200)

              // 3초 무응답 시 추천 (파일 선택 시 취소됨)
              if (recommendTimerRef.current) clearTimeout(recommendTimerRef.current)
              recommendTimerRef.current = setTimeout(() => {
                if (menuStateRef.current === "file_select") {
                  speak("추천해드릴까요? 가장 최근 파일로 분석할게요.", speechRate, 1.7, () => {
                    loadFileByName(files[0].name)
                  })
                }
              }, 3000)
            })
          })
          .catch(e => {
            console.error("[파일 목록] 에러:", e)
            speak("폴더를 열 수 없어요. 파일 선택 창을 열게요.", speechRate, 1.7, () => {
              setTimeout(() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click(), 300)
            })
          })
      })
      return
    }


    // 문서 업로드 - 이미지와 동일하게 폴더 열기
    if (/pdf|문서|파일|서류/.test(t) &&
        /업로드|분석|읽어|열어|올려|해줘|시작|있어/.test(t)) {
      // 바로 폴더 파일 목록 가져오기
      speak("업로드 폴더를 확인하고 있어요.", speechRate, 1.7, () => {
        console.log("[문서 목록] TTS 완료, 폴더 열기 + API 호출 시작")

        // Windows 탐색기로 폴더 열기
        fetch("/api/open-folder", { method: "POST" })
          .then(() => console.log("[폴더] 열림"))
          .catch(e => console.error("[폴더] 열기 실패:", e))

        // 파일 목록 가져오기
        fetch("/api/watch-folder")
          .then(res => res.json())
          .then(data => {
            const files = data.files || []
            console.log("[문서 목록] 파일:", files.length, "개")

            if (files.length === 0) {
              speak("폴더에 파일이 없어요. 파일을 폴더에 넣어주세요.", speechRate)
              return
            }

            setUploadFiles(files)
            setMenuState("file_list")

            // 파일 목록 읽어주기
            const fileList = files.slice(0, 5).map((f: UploadFile, i: number) =>
              `${i + 1}번. ${f.name.replace(/\.(jpg|jpeg|png|webp|pdf)$/i, '')}`
            ).join(". ")

            const message = files.length > 5
              ? `${fileList}. 총 ${files.length}개 파일이 있어요. 파일 이름을 말씀해 주세요.`
              : `${fileList}. 파일 이름을 말씀해 주세요.`

            speak(message, speechRate, 1.7, () => {
              setMenuState("file_select")
              playMicOn()
              setTimeout(() => {
                stt.startListening()
                setMicState("listening")
              }, 200)

              // 3초 무응답 시 추천 (파일 선택 시 취소됨)
              if (recommendTimerRef.current) clearTimeout(recommendTimerRef.current)
              recommendTimerRef.current = setTimeout(() => {
                if (menuStateRef.current === "file_select") {
                  speak("추천해드릴까요? 가장 최근 파일로 분석할게요.", speechRate, 1.7, () => {
                    loadFileByName(files[0].name)
                  })
                }
              }, 3000)
            })
          })
          .catch(e => {
            console.error("[파일 목록] 에러:", e)
            speak("폴더를 열 수 없어요.", speechRate)
          })
      })
      return
    }

    // 모델 선택 번호 (즉시)
    const modelMap: Record<string, {id: string, name: string}> = {
      "일번|구글4|구글사|포지|사기가": { id: "gemma4:e4b", name: "구글 4기가" },
      "이번|큐쓰리|큐스리|큐삼|q3": { id: "qwen3.5:9b", name: "큐쓰리" },
      "삼번|구글2|구글이|이기가|이지": { id: "gemma4:e2b", name: "구글 2기가" },
      "사번|라마|라마비전|비전": { id: "llama3.2-vision:11b-instruct-q4_K_M", name: "라마비전" },
      "오번|올름|olmocr": { id: "richardyoung/olmocr2:7b-q8", name: "올름오씨알" },
    }
    for (const [pattern, model] of Object.entries(modelMap)) {
      if (new RegExp(pattern).test(t)) {
        setSelectedModel(model.id)
        if (menuStateRef.current === "model_select" || menuStateRef.current === "confirm") {
          speak(`${model.name}으로 분석할게요.`, speechRate, 1.7, () => {
            if (pendingFile) executeAnalysis(pendingFile, model.id)
          })
        } else {
          speak(`${model.name}으로 바꿨어요.`, speechRate)
        }
        setMenuState("idle")
        return
      }
    }

    // 음악
    if (/음악꺼|bgm꺼|노래꺼/.test(t)) { bgmManager.pause(); speak("음악을 껐어요.", speechRate); return }
    if (/음악켜|bgm켜|노래켜/.test(t)) { bgmManager.start(speechRate); speak("음악을 켰어요.", speechRate); return }

    // 유튜브 음악 검색
    if (/유튜브|유튜브음악|다른음악|음악바꿔|다른노래/.test(t)) {
      speak("어떤 음악 틀어드릴까요? 말씀해 주세요.", speechRate, 1.7, () => {
        setTimeout(() => {
          setMenuState("youtube_search")
          playMicOn()
          setTimeout(() => stt.startListening(), 200)
        }, 300)
      })
      return
    }

    // 처음으로
    if (/처음으로|처음부터|메인으로|다시처음/.test(t)) {
      window.speechSynthesis.cancel(); bgmManager.pause()
      setMenuState("idle"); setPendingFile(null)
      speak("처음으로 돌아갈게요. 스페이스바를 누르고 말씀해 주세요.", speechRate)
      return
    }

    // 긍정 피드백 (만족)
    if (/만족|좋아|훌륭|완벽|최고|감사|고마워/.test(t)) {
      speak("감사합니다! 다음 사용자를 위해 준비하고 있어요.", speechRate)
      sessionManager.submitPositiveFeedback()
      return
    }

    // 부정 피드백 (불만족)
    if (/아니|틀렸|잘못|다시|이상/.test(t)) {
      speak("죄송합니다. 다시 시도해 주세요.", speechRate)
      sessionManager.submitNegativeFeedback()
      return
    }

    // 전체 중단 / 종료
    if (/이제그만|다그만|그만해|전부꺼|종료|끝|나가/.test(t)) {
      window.speechSynthesis.cancel(); bgmManager.pause()
      speak("이용해 주셔서 감사합니다. 다음 사용자를 위해 준비하고 있어요.", speechRate)
      sessionManager.forceEnd()
      return
    }

    // 다시 시작
    if (/다시시작|다시해봐|이어서|계속해|다시읽어/.test(t)) {
      if (lastResponse) { speak(lastResponse, speechRate); return }
      if (pendingFile) { executeAnalysis(pendingFile, selectedModel); return }
      speak("이어서 할 작업이 없어요.", speechRate)
      return
    }

    // 확인/네
    if (/^(네|예|그래|좋아|맞아|시작해|해줘|응)$/.test(t)) {
      if (pendingFile && menuStateRef.current === "confirm") {
        executeAnalysis(pendingFile, selectedModel)
      } else {
        doChat(transcript)
      }
      return
    }

    // ── LLM 처리 (위에서 안 걸린 경우) ─────────────
    // 모델 변경 요청인지만 확인 후 나머지는 채팅
    if (/모델|바꿔|변경|다른모델/.test(t)) {
      setMenuState("model_select")
      speak("어떤 모델로 바꿔드릴까요? 일번 구글 4기가, 이번 큐쓰리, 삼번 구글 2기가, 사번 라마비전, 오번 올름오씨알이에요.", speechRate)
      return
    }

    // 나머지: 일반 채팅
    doChat(transcript)
  }

  const executeCurrentAction = () => {
    if (!pendingAction) {
      setMicState("off")
      return
    }

    const [type, value] = pendingAction.split(":")

    if (type === "model") {
      const modelNames: Record<string, string> = {
        "gemma4:e2b": "구글 2기가",
        "gemma4:e4b": "구글 4기가",
        "llama3.2-vision:11b-instruct-q4_K_M": "라마비전",
        "qwen3.5:9b": "큐쓰리",
        "qwen3.5:9b-image": "큐쓰리",
        "richardyoung/olmocr2:7b-q8": "올름오씨알"
      }

      let message = ""
      if (value === "llama3.2-vision:11b-instruct-q4_K_M") {
        message = "라마비전으로 분석할게요. 조금 시간이 걸릴 수 있어요. 최대 10분 정도요. 음악 들으시면서 편하게 기다려 주세요."
      } else {
        message = `${modelNames[value]}으로 분석 시작할게요. 잠시만 기다려 주세요.`
      }

      speak(message, speechRate, 1.7, () => {
        setMenuState("idle")
        setMicState("processing")

        // TTS 끝난 후 분석 시작 (BGM은 processFile에서 자동 시작)
        console.log("[executeCurrentAction] TTS 끝남, 파일 분석 시작")
        // 파일 분석 시작
        if (pendingFile) {
          console.log("[executeCurrentAction] 파일 분석 시작:", pendingFile.name)
          window.dispatchEvent(new CustomEvent("startAnalysis", { detail: { file: pendingFile, model: value } }))
          setPendingFile(null)
        } else {
          console.log("[executeCurrentAction] pendingFile 없음")
        }
      })

      setPendingAction("")
    }
  }


  const doChat = async (text: string) => {
    setMicState("processing")
    setResponse("")

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok) throw new Error("API error")

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value)
        setResponse(full)
      }

      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: full }])
      setMicState("speaking")
      speak(full)

      // TTS 끝나면 자동으로 off
      setTimeout(() => {
        setMicState("off")
      }, (full.length / 10) * 1000 / speechRate)
    } catch {
      const err = "오류가 발생했습니다. 다시 시도해 주세요."
      setResponse(err)
      speak(err)
      setMicState("speaking")
      setTimeout(() => setMicState("off"), 3000)
    }
  }

  const micStateLabel: Record<MicState, string> = {
    off: "스페이스바를 누르고 말씀하세요",
    listening: "듣고 있습니다... (스페이스바로 완료)",
    processing: "처리 중...",
    speaking: "읽는 중... (스페이스바로 중지)",
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EBF5FF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: "Pretendard Variable, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 900,
            color: "#0284C7",
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          READ VOICE Pro
        </h1>

        <p
          style={{
            color: "#475569",
            marginBottom: "2.5rem",
            fontSize: "1.125rem",
            textAlign: "center",
          }}
        >
          AI 음성 도우미
        </p>

        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: micState === "listening" ? "#0284C7" : micState === "processing" ? "#F59E0B" : micState === "speaking" ? "#10B981" : "#94A3B8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3rem",
            color: "white",
            marginBottom: "1.5rem",
            transition: "all 0.3s",
            animation: micState === "listening" ? "pulse 1.5s infinite" : "none",
          }}
        >
          {micState === "listening" ? "🎤" : micState === "processing" ? "⏳" : micState === "speaking" ? "🔊" : "💤"}
        </div>

        <p
          aria-live="polite"
          style={{
            marginBottom: "1.5rem",
            color: "#0369A1",
            fontWeight: 600,
            fontSize: "1.125rem",
            textAlign: "center",
          }}
        >
          {micStateLabel[micState]}
        </p>

        <div
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          {[0.5, 1, 1.5, 2, 2.5, 3].map((rate) => (
            <button
              key={rate}
              onClick={() => {
                setSpeechRate(rate)
                saveSpeechRate(rate)
                speak(`읽기 속도가 ${rate}배로 변경되었습니다.`, 1.0)
              }}
              aria-label={`읽기 속도 ${rate}배`}
              style={{
                minWidth: "48px",
                minHeight: "48px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "1rem",
                transition: "all 0.2s",
                background: speechRate === rate ? "#0284C7" : "#EBF5FF",
                color: speechRate === rate ? "white" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {rate}x
            </button>
          ))}
        </div>

        {stt.transcript && (
          <div
            style={{
              marginBottom: "1.5rem",
              background: "#DBEAFE",
              borderRadius: "0.75rem",
              padding: "1rem",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#1E3A5F",
                fontSize: "1rem",
                margin: 0,
              }}
            >
              인식: {stt.transcript}
            </p>
          </div>
        )}

        <ResponseDisplay
          response={response}
          status={micState === "speaking" ? "speaking" : "idle"}
          onStop={() => {
            window.speechSynthesis.cancel()
            setMicState("off")
          }}
        />

        {stt.error && (
          <p
            style={{
              color: "#EF4444",
              marginBottom: "1rem",
              fontSize: "1rem",
            }}
          >
            {stt.error}
          </p>
        )}

        <div
          style={{
            marginTop: "2rem",
            width: "100%",
          }}
        >
          <p
            style={{
              color: "#0D9488",
              fontWeight: 700,
              fontSize: "1rem",
              marginBottom: "0.75rem",
              textAlign: "center",
            }}
          >
            📄 파일에서 텍스트 읽기 (이미지 / PDF)
          </p>
          <FileUpload
            onResult={(text) => {
              // BGM 중지
              console.log("[onResult] 분석 완료, BGM 중지")
              bgmManager.pause()
              setResponse(text)
              setMicState("speaking")

              // 세션 매니저에 분석 완료 알림 (피드백 대기)
              sessionManager.onAnalysisComplete({
                result: text,
                model: selectedModel,
                fileName: selectedFileName || pendingFile?.name
              })

              // 다국어 지원 예정: 언어 선택에 따라 TTS 언어 변경 가능

              // 분석 완료 안내 → 결과 읽기 → 후속 안내 (onEnd 콜백으로 연결)
              tts.speak("분석이 끝났어요! 읽어드릴게요.", speechRate, () => {
                // 결과 텍스트 읽기
                tts.speak(text, speechRate, () => {
                  // 텍스트 읽기가 끝난 후 - 피드백 요청
                  const msg = "만족하시면 '좋아요', 다시 하시려면 '다시'라고 말씀해 주세요."
                  tts.speak(msg, speechRate, () => {
                    setMicState("off")
                    setMenuState("idle")
                  })
                })
              })
            }}
            onStatusChange={(s) => {
              if (s === "processing") setMicState("processing")
              else if (s === "speaking") setMicState("speaking")
              else setMicState("off")
            }}
            selectedModel={selectedModel}
            onModelChange={(modelId) => {
              setSelectedModel(modelId)
            }}
            onFileSelected={(file) => {
              setPendingFile(file)
              // 따뜻한 안내
              speak("이미지 인식되었습니다. 어떤 모델로 읽어드릴까요?", speechRate, 1.7, () => {
                // 2초 후 모델 선택 안내
                setTimeout(() => {
                  speak(MODEL_MENU_TTS, speechRate, 1.7, () => {
                    setMenuState("model_select")
                    playMicOn()
                    setTimeout(() => {
                      stt.startListening()
                      setMicState("listening")
                    }, 200)
                  })
                }, 2000)
              })
            }}
          />
        </div>

        {/* 유튜브 음악 재생 (숨김) */}
        {showYoutube && (
          <iframe
            src={youtubeUrl.replace("watch?v=", "embed/") + "?autoplay=1"}
            style={{ display: "none" }}
            allow="autoplay"
            title="YouTube Music Player"
          />
        )}

        <p
          style={{
            marginTop: "2rem",
            color: "#94A3B8",
            fontSize: "0.95rem",
            textAlign: "center",
          }}
        >
          스페이스바 1회: 마이크 ON/OFF<br />
          스페이스바 2회: 메인 메뉴
        </p>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
      `}</style>
    </main>
  )
}
