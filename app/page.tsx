"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSpeechRecognition } from "@/lib/speech/stt"
import { useSpeechSynthesis, cleanForTTS } from "@/lib/speech/tts"
import { parseSpeedCommand, saveSpeechRate, loadSpeechRate } from "@/lib/speech/speed-control"
import FileUpload, { IMAGE_MODELS, DOCUMENT_MODELS } from "@/app/components/FileUpload"
import MicButton from "@/app/components/MicButton"
import ResponseDisplay from "@/app/components/ResponseDisplay"
import { bgmManager } from "@/lib/audio/bgm-manager"

type MicState = "off" | "listening" | "processing" | "speaking"
type MenuState = "idle" | "main_menu" | "model_select" | "confirm" | "ocr" | "image" | "ask_original"
type FileType = "image" | "document" | null

const INTRO_TTS = `안녕하세요! READ VOICE Pro예요.
스페이스바를 누르고 말씀해 주시면 바로 도와드릴게요.
말씀이 끝나시면 스페이스바를 다시 눌러 주세요.
스페이스바를 빠르게 두 번 누르시면 처음으로 돌아가요.`

const MAIN_MENU_TTS = `어떻게 도와드릴까요?
일번. 무언가 검색해 드릴게요.
이번. 사진이나 이미지를 분석해 드릴게요.
삼번. 문서를 읽어드릴게요.
사번. 분석 모델을 바꿔드릴게요.
오번. 처음으로 돌아가요.
스페이스바를 누르고 번호나 원하시는 걸 말씀해 주세요.`

const IMAGE_MODEL_MENU_TTS = `어떤 모델로 설명해 드릴까요?
일번. 구글 이기가. 가장 빠릅니다.
이번. 구글 사기가. 빠르고 정확합니다.
삼번. 라마비전. 가장 상세합니다.
스페이스바를 누르고 번호로 말씀해 주세요.`

const DOCUMENT_MODEL_MENU_TTS = `어떤 모델로 읽어 드릴까요?
일번. 큐쓰리. 텍스트와 문서에 강합니다.
이번. 올름오씨알. 표와 레이아웃에 강합니다.
삼번. 지엘엠. 문서 특화 모델입니다.
사번. 구글 사기가. 빠르고 정확합니다.
스페이스바를 누르고 번호로 말씀해 주세요.`

const MODEL_MENU_TTS = `어떤 모델로 분석해 드릴까요?
일번. 구글 이기가. 가장 빠르게 분석해드려요.
이번. 구글 사기가. 빠르면서 정확하게 분석해드려요.
삼번. 라마비전. 가장 꼼꼼하게 분석해드려요.
사번. 큐쓰리. 텍스트 인식에 강해요.
오번. 지엘엠. 문서 읽기에 특화되어 있어요.
스페이스바를 누르고 번호로 말씀해 주세요.`

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
}

export default function Home() {
  const [micState, setMicState] = useState<MicState>("off")
  const [menuState, setMenuState] = useState<MenuState>("idle")
  const [response, setResponse] = useState("")
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [speechRate, setSpeechRate] = useState<number>(1.0)
  const [selectedModel, setSelectedModel] = useState<string>("gemma4:e2b")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingAction, setPendingAction] = useState<string>("")
  const [originalText, setOriginalText] = useState<string>("")
  const [lastResponse, setLastResponse] = useState<string>("")
  const [previousMenuState, setPreviousMenuState] = useState<MenuState>("idle")
  const [fileType, setFileType] = useState<FileType>(null)

  const micStateRef = useRef<MicState>("off")
  const menuStateRef = useRef<MenuState>("idle")
  const isWaitingSpeedChoiceRef = useRef<boolean>(false)

  const stt = useSpeechRecognition()
  const tts = useSpeechSynthesis()

  const lastSpaceTimeRef = useRef<number>(0)
  const spaceCountRef = useRef<number>(0)
  const spaceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 초기 설정
  useEffect(() => {
    setSpeechRate(loadSpeechRate())

    // 업로드 폴더 자동 생성
    fetch("/api/watch-folder").catch(() => {
      console.log("[폴더 생성] 실패")
    })

    // 페이지 포커스 강제 설정
    document.body.focus()
    document.body.setAttribute("tabindex", "0")
    document.body.focus()

    // 1초 후 안내
    const timer = setTimeout(() => {
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(INTRO_TTS)
      utt.lang = "ko-KR"
      utt.rate = 1.15
      utt.pitch = 1.7  // 솔 높이 (밝고 경쾌한 음성)
      window.speechSynthesis.speak(utt)
    }, 1000)

    return () => clearTimeout(timer)
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
    window.speechSynthesis.cancel()
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
    speak("네, 말씀해 주세요.")
    setTimeout(() => {
      stt.startListening()
      setMicState("listening")
    }, 500)
  }, [stt, speak])

  const stopListening = useCallback(() => {
    stt.stopListening()
    setMicState("off")
  }, [stt])

  // imageSelected 이벤트 수신 (사진)
  useEffect(() => {
    const handleImageSelected = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("image")
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("imageSelected", handleImageSelected as EventListener)
    return () => window.removeEventListener("imageSelected", handleImageSelected as EventListener)
  }, [startListening])

  // imageDocSelected 이벤트 수신 (문서 이미지)
  useEffect(() => {
    const handleImageDocSelected = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("document")
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("imageDocSelected", handleImageDocSelected as EventListener)
    return () => window.removeEventListener("imageDocSelected", handleImageDocSelected as EventListener)
  }, [startListening])

  // imageMixedSelected 이벤트 수신 (혼합)
  useEffect(() => {
    const handleImageMixedSelected = (event: CustomEvent<{ file: File, classification: string }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("image") // 혼합은 일단 image로 처리
      setMenuState("confirm") // 특수 모드: 그림 먼저 vs 글자 먼저
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("imageMixedSelected", handleImageMixedSelected as EventListener)
    return () => window.removeEventListener("imageMixedSelected", handleImageMixedSelected as EventListener)
  }, [startListening])

  // classifyFailed 이벤트 수신
  useEffect(() => {
    const handleClassifyFailed = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType(null)
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("classifyFailed", handleClassifyFailed as EventListener)
    return () => window.removeEventListener("classifyFailed", handleClassifyFailed as EventListener)
  }, [startListening])

  // pdfScannedSelected 이벤트 수신
  useEffect(() => {
    const handlePdfScannedSelected = (event: CustomEvent<{ file: File }>) => {
      const { file } = event.detail
      setPendingFile(file)
      setFileType("document")
      setMenuState("model_select")
      setMicState("off")

      setTimeout(() => startListening(), 500)
    }

    window.addEventListener("pdfScannedSelected", handlePdfScannedSelected as EventListener)
    return () => window.removeEventListener("pdfScannedSelected", handlePdfScannedSelected as EventListener)
  }, [startListening])

  // 싱글탭: 현재 동작 중지 + 마이크 ON
  const handleSingleSpace = useCallback(() => {
    console.log("[handleSingleSpace] TTS/BGM 중지")
    window.speechSynthesis.cancel()
    bgmManager.stop()

    if (stt.isListening) {
      // 마이크 ON 상태 → 마이크 끄고 STT 결과 처리
      console.log("[마이크] 완료")
      stopListening()
      return
    }

    // 마이크 OFF 상태 → 마이크 켜기
    console.log("[마이크] 시작")
    startListening()
  }, [stt.isListening, startListening, stopListening])

  // 더블탭: 처음 메뉴로
  const handleDoubleSpace = useCallback(() => {
    console.log("[handleDoubleSpace] 더블탭 - 메인 메뉴, TTS/BGM 중지")
    window.speechSynthesis.cancel()
    bgmManager.stop()
    stt.stopListening()
    setMicState("off")
    setMenuState("main_menu")
    speak(MAIN_MENU_TTS)
  }, [stt, speak])

  // 스페이스바 이벤트 등록
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return

      if (e.code === "Space") {
        e.preventDefault()

        const now = Date.now()

        // 더블탭 감지 (300ms 이내 두 번)
        if (now - lastSpaceTimeRef.current < 300) {
          spaceCountRef.current = 2
          if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current)
          handleDoubleSpace()
          lastSpaceTimeRef.current = 0
          spaceCountRef.current = 0
          return
        }

        lastSpaceTimeRef.current = now
        spaceCountRef.current = 1

        // 싱글탭은 300ms 후 처리
        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current)
        spaceTimerRef.current = setTimeout(() => {
          if (spaceCountRef.current === 1) {
            console.log("[스페이스] 싱글탭 - 마이크 토글")
            handleSingleSpace()
          }
          spaceCountRef.current = 0
        }, 300)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSingleSpace, handleDoubleSpace])

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

  const handleVoiceResult = async (transcript: string) => {
    const currentMenu = menuStateRef.current
    console.log("[처리] 현재 메뉴:", currentMenu, "입력:", transcript)

    const t = transcript.toLowerCase()

    // === 자연어 명령어 체크 (최우선 처리) ===

    // 중지/취소
    if (VOICE_COMMANDS.stop.test(t)) {
      window.speechSynthesis.cancel()
      bgmManager.stop()
      stt.stopListening()
      setMicState("off")
      speak("멈췄어요.")
      setTimeout(() => setMicState("off"), 1500)
      return
    }

    // 다시/반복
    if (VOICE_COMMANDS.repeat.test(t)) {
      if (lastResponse) {
        setMicState("speaking")
        speak(lastResponse)
        const delay = (lastResponse.length / 10) * 1000 / speechRate + 1000
        setTimeout(() => setMicState("off"), delay)
      } else {
        speak("다시 읽어드릴 내용이 없어요.")
        setTimeout(() => setMicState("off"), 1500)
      }
      return
    }

    // 처음으로
    if (VOICE_COMMANDS.home.test(t)) {
      window.speechSynthesis.cancel()
      bgmManager.stop()
      stt.stopListening()
      setMenuState("idle")
      setMicState("speaking")
      speak(MAIN_MENU_TTS)
      const delay = (MAIN_MENU_TTS.length / 10) * 1000 / speechRate + 1000
      setTimeout(() => setMicState("off"), delay)
      return
    }

    // 이전으로
    if (VOICE_COMMANDS.back.test(t)) {
      setMenuState(previousMenuState)
      setMicState("speaking")
      speak("이전으로 돌아갈게요.")
      setTimeout(() => setMicState("off"), 1500)
      return
    }

    // 이미지 관련
    if (VOICE_COMMANDS.image.test(t)) {
      setMenuState("image")
      setMicState("off")
      // 즉시 파일 선택창 열기 (사용자 제스처 컨텍스트 내에서)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) {
        fileInput.click()
      }
      return
    }

    // 문서/OCR 관련
    if (VOICE_COMMANDS.document.test(t)) {
      setMenuState("ocr")
      setMicState("off")
      // 즉시 파일 선택창 열기 (사용자 제스처 컨텍스트 내에서)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) {
        fileInput.click()
      }
      return
    }

    // 모델 변경
    if (VOICE_COMMANDS.changeModel.test(t)) {
      setMenuState("model_select")
      setMicState("speaking")
      speak(MODEL_MENU_TTS)
      const delay = (MODEL_MENU_TTS.length / 10) * 1000 / speechRate + 1000
      setTimeout(() => {
        setMicState("off")
        startListening()
      }, delay)
      return
    }

    // 종료
    if (VOICE_COMMANDS.quit.test(t)) {
      window.speechSynthesis.cancel()
      bgmManager.stop()
      stt.stopListening()
      setMicState("speaking")
      speak("종료합니다.")
      setTimeout(() => {
        setMicState("off")
      }, 1500)
      return
    }

    // 완료
    if (VOICE_COMMANDS.done.test(t)) {
      setMicState("speaking")
      speak("네, 알겠어요.")
      setTimeout(() => setMicState("off"), 1500)
      return
    }


    // === 기존 명령어 처리 ===

    // 속도 변경 명령 확인
    const speedCmd = parseSpeedCommand(transcript, isWaitingSpeedChoiceRef.current)
    if (speedCmd !== null) {
      if (speedCmd.message === "speed_menu") {
        setMicState("speaking")
        const menu = "읽기 속도를 선택해 주세요. 1번, 보통 속도. 2번, 조금 빠르게. 3번, 빠르게. 4번, 매우 빠르게. 번호로 말씀해 주세요."
        speak(menu, 1.0)
        isWaitingSpeedChoiceRef.current = true
        setTimeout(() => setMicState("off"), 3000)
        return
      }

      setSpeechRate(speedCmd.rate)
      saveSpeechRate(speedCmd.rate)
      setMicState("speaking")
      speak(speedCmd.message, 1.0)
      isWaitingSpeedChoiceRef.current = false
      setTimeout(() => setMicState("off"), 2000)
      return
    }

    // 현재 모델 선택 대기 중
    if (currentMenu === "model_select") {
      let modelId = ""
      let modelName = ""

      // fileType에 따라 다른 모델 매핑
      if (fileType === "image") {
        // 이미지 모델 (3개)
        if (/일번|1|구글.?이기가|이기가|구글.?2|gemma.*e2b/i.test(t)) {
          modelId = "gemma4:e2b"
          modelName = "구글 이기가"
        } else if (/이번|2|구글.?사기가|사기가|구글.?4|gemma.*e4b/i.test(t)) {
          modelId = "gemma4:e4b"
          modelName = "구글 사기가"
        } else if (/삼번|3|라마|llama|비전/i.test(t)) {
          modelId = "llama3.2-vision:11b-instruct-q4_K_M"
          modelName = "라마비전"
        }
      } else if (fileType === "document") {
        // 문서 모델 (5개 - PDF 스캔본용)
        if (/일번|1|큐|qwen|q3|큐쓰리/i.test(t)) {
          modelId = "qwen3.5:9b"
          modelName = "큐쓰리"
        } else if (/이번|2|올름|olmocr|올름오씨알/i.test(t)) {
          modelId = "richardyoung/olmocr2:7b-q8"
          modelName = "올름오씨알"
        } else if (/삼번|3|지엘엠|glm/i.test(t)) {
          modelId = "glm-ocr"
          modelName = "지엘엠"
        } else if (/사번|4|구글.?사기가|사기가|구글.?4|gemma.*e4b/i.test(t)) {
          modelId = "gemma4:e4b"
          modelName = "구글 사기가"
        } else if (/오번|5|라마|llama|비전/i.test(t)) {
          modelId = "llama3.2-vision:11b-instruct-q4_K_M"
          modelName = "라마비전"
        }
      } else {
        // fileType이 설정되지 않은 경우 (기존 로직 유지)
        if (/일번|1|구글.?이기가|이기가|구글.?2|gemma.*e2b/i.test(t)) {
          modelId = "gemma4:e2b"
          modelName = "구글 이기가"
        } else if (/이번|2|구글.?사기가|사기가|구글.?4|gemma.*e4b/i.test(t)) {
          modelId = "gemma4:e4b"
          modelName = "구글 사기가"
        } else if (/삼번|3|라마|llama|비전/i.test(t)) {
          modelId = "llama3.2-vision:11b-instruct-q4_K_M"
          modelName = "라마비전"
        } else if (/사번|4|큐|qwen|q3/i.test(t)) {
          modelId = "qwen3.5:9b"
          modelName = "큐쓰리"
        } else if (/오번|5|지엘엠|glm/i.test(t)) {
          modelId = "glm-ocr"
          modelName = "지엘엠"
        }
      }

      if (modelId) {
        setSelectedModel(modelId)
        setPendingAction(`model:${modelId}`)

        let confirmMsg = ""
        if (modelId === "llama3.2-vision:11b-instruct-q4_K_M") {
          confirmMsg = `${modelName}으로 분석해 드릴까요? 스페이스바를 누르고 네 또는 아니오로 말씀해 주세요.`
        } else {
          confirmMsg = `${modelName}으로 분석해 드릴까요? 스페이스바를 누르고 네 또는 아니오로 말씀해 주세요.`
        }

        speak(confirmMsg)
        setMenuState("confirm")

        const delay = (confirmMsg.length / 10) * 1000 / speechRate + 1000
        setTimeout(() => {
          setMicState("off")
          startListening()
        }, delay)
      } else {
        const maxNum = fileType === "image" ? "삼번" : fileType === "document" ? "오번" : "오번"
        speak(`죄송해요, 잘 못 들었어요. 일번부터 ${maxNum} 중에 번호로 말씀해 주세요.`)
        const delay = (35 / 10) * 1000 / speechRate + 500
        setTimeout(() => {
          setMicState("off")
          startListening()
        }, delay)
      }
      return
    }

    // 현재 확인 대기 중
    if (currentMenu === "confirm") {
      if (/그래|좋아|네|예|맞아|실행|해줘|시작/.test(t)) {
        executeCurrentAction()
        return
      }
      if (/아니|취소|싫어|말고/.test(t)) {
        const msg1 = "알겠어요, 모델 선택으로 돌아갈게요."
        speak(msg1)
        const delay1 = (msg1.length / 10) * 1000 / speechRate + 300
        setTimeout(() => {
          speak(MODEL_MENU_TTS)
          setMenuState("model_select")
          const delay2 = (MODEL_MENU_TTS.length / 10) * 1000 / speechRate + 500
          setTimeout(() => {
            setMicState("off")
            startListening()
          }, delay2)
        }, delay1)
        return
      }
      // 네/아니오가 아닌 경우
      speak("네 또는 아니오로 말씀해 주세요.")
      const delay = (18 / 10) * 1000 / speechRate + 500
      setTimeout(() => {
        setMicState("off")
        startListening()
      }, delay)
      return
    }

    // 원문 듣기 확인 대기 중
    if (currentMenu === "ask_original") {
      if (/그래|좋아|네|예|맞아|들려|듣고|원해/.test(t)) {
        setMicState("speaking")
        speak("원문을 들려드릴게요.")
        setTimeout(() => {
          // 영어로 원문 읽기
          const utt = new SpeechSynthesisUtterance(originalText)
          utt.lang = "en-US"  // 영어 음성
          utt.rate = speechRate
          utt.pitch = 1.0
          utt.onend = () => {
            speak("원문 듣기가 끝났어요.")
            setTimeout(() => {
              setMenuState("idle")
              setMicState("off")
            }, 1500)
          }
          window.speechSynthesis.speak(utt)
        }, 1500)
        return
      }
      if (/아니|취소|싫어|말고|괜찮|됐/.test(t)) {
        speak("알겠어요. 끝났어요.")
        setTimeout(() => {
          setMenuState("idle")
          setMicState("off")
        }, 1500)
        return
      }
      // 네/아니오가 아닌 경우
      speak("네 또는 아니오로 말씀해 주세요.")
      const delay = (18 / 10) * 1000 / speechRate + 500
      setTimeout(() => {
        setMicState("off")
        startListening()
      }, delay)
      return
    }

    // 일반 상태 - 의도 파악
    const intent = await detectIntent(transcript)

    switch (intent) {
      case "search":
        setMicState("speaking")
        speak("네, 바로 찾아드릴게요.")
        setTimeout(() => doChat(transcript), 1500)
        break
      case "ocr":
        setMenuState("ocr")
        setMicState("off")
        // 즉시 파일 선택창 열기
        const fileInput1 = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput1) fileInput1.click()
        break
      case "image":
        setMenuState("image")
        setMicState("off")
        // 즉시 파일 선택창 열기
        const fileInput2 = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput2) fileInput2.click()
        break
      case "model_change":
        speak(MODEL_MENU_TTS)
        setMenuState("model_select")
        const delayModelChange = (MODEL_MENU_TTS.length / 10) * 1000 / speechRate + 500
        setTimeout(() => {
          setMicState("off")
          startListening()
        }, delayModelChange)
        break
      case "confirm":
        executeCurrentAction()
        break
      case "cancel":
        setMicState("speaking")
        speak("알겠어요, 취소할게요.")
        setTimeout(() => {
          speak(MAIN_MENU_TTS)
          setMenuState("main_menu")
          const delay = (MAIN_MENU_TTS.length / 10) * 1000 / speechRate + 500
          setTimeout(() => setMicState("off"), delay)
        }, 1500)
        break
      case "restart":
        setMicState("speaking")
        speak("처음으로 돌아갈게요.")
        setTimeout(() => {
          speak(INTRO_TTS)
          setMenuState("idle")
          const delay = (INTRO_TTS.length / 10) * 1000 / speechRate + 500
          setTimeout(() => setMicState("off"), delay)
        }, 1000)
        break
      case "menu_1":
        handleMenuChoice(1)
        break
      case "menu_2":
        handleMenuChoice(2)
        break
      case "menu_3":
        handleMenuChoice(3)
        break
      case "menu_4":
        handleMenuChoice(4)
        break
      case "menu_5":
        handleMenuChoice(5)
        break
      case "menu_6":
        handleMenuChoice(6)
        break
      case "chat":
      default:
        doChat(transcript)
        break
    }
  }

  const detectIntent = async (text: string): Promise<string> => {
    const t = text.toLowerCase()

    if (/검색|찾아|알려|뭐야|어때/.test(t)) return "search"
    if (/문서|읽어|오씨알|ocr|파일|pdf/.test(t)) return "ocr"
    if (/이미지|사진|그림/.test(t)) return "image"
    if (/모델|바꿔|바꾸기/.test(t)) return "model_change"
    if (/그래|그렇다|좋아|네|예|맞아|실행|시작|해줘/.test(t)) return "confirm"
    if (/아니|취소|싫어|말고/.test(t)) return "cancel"
    if (/처음|돌아가|시작으로/.test(t)) return "restart"

    if (/일번|1번/.test(t)) return "menu_1"
    if (/이번|2번/.test(t)) return "menu_2"
    if (/삼번|3번/.test(t)) return "menu_3"
    if (/사번|4번/.test(t)) return "menu_4"
    if (/오번|5번/.test(t)) return "menu_5"
    if (/육번|6번/.test(t)) return "menu_6"

    return "chat"
  }

  const handleMenuChoice = (num: number) => {
    if (menuStateRef.current === "main_menu") {
      switch (num) {
        case 1:
          speak("검색 모드예요. 검색할 내용을 말씀해 주세요.")
          setTimeout(() => {
            setMicState("off")
            startListening()
          }, 2000)
          break
        case 2:
          speak("이미지 분석 모드예요. 파일을 올려주세요.")
          setMenuState("image")
          setMicState("off")
          break
        case 3:
          speak("문서 읽기 모드예요. 파일을 올려주시거나 카메라 버튼을 눌러주세요.")
          setMenuState("ocr")
          setMicState("off")
          break
        case 4:
          speak(MODEL_MENU_TTS)
          setMenuState("model_select")
          const delayMenu4 = (MODEL_MENU_TTS.length / 10) * 1000 / speechRate + 500
          setTimeout(() => {
            setMicState("off")
            startListening()
          }, delayMenu4)
          break
        case 5:
          speak("처음으로 돌아갈게요.")
          setTimeout(() => {
            speak(INTRO_TTS)
            setMenuState("idle")
            setMicState("off")
          }, 1000)
          break
      }
    } else if (menuStateRef.current === "model_select") {
      let models: Array<{ id: string; name: string }> = []

      if (fileType === "image") {
        models = [
          { id: "gemma4:e2b", name: "구글 이기가" },
          { id: "gemma4:e4b", name: "구글 사기가" },
          { id: "llama3.2-vision:11b-instruct-q4_K_M", name: "라마비전" }
        ]
      } else if (fileType === "document") {
        models = [
          { id: "qwen3.5:9b", name: "큐쓰리" },
          { id: "richardyoung/olmocr2:7b-q8", name: "올름오씨알" },
          { id: "glm-ocr", name: "지엘엠" },
          { id: "gemma4:e4b", name: "구글 사기가" },
          { id: "llama3.2-vision:11b-instruct-q4_K_M", name: "라마비전" }
        ]
      } else {
        // 기존 로직 (fileType 없는 경우)
        models = [
          { id: "gemma4:e2b", name: "구글 이기가" },
          { id: "gemma4:e4b", name: "구글 사기가" },
          { id: "llama3.2-vision:11b-instruct-q4_K_M", name: "라마비전" },
          { id: "qwen3.5:9b", name: "큐쓰리" },
          { id: "glm-ocr", name: "지엘엠" }
        ]
      }

      if (num >= 1 && num <= models.length) {
        const model = models[num - 1]
        setSelectedModel(model.id)
        setPendingAction(`model:${model.id}`)

        let confirmMsg = ""
        if (model.id === "llama3.2-vision:11b-instruct-q4_K_M") {
          confirmMsg = `${model.name}으로 분석해 드릴까요? 스페이스바를 누르고 네 또는 아니오로 말씀해 주세요.`
        } else {
          confirmMsg = `${model.name}으로 분석해 드릴까요? 스페이스바를 누르고 네 또는 아니오로 말씀해 주세요.`
        }

        speak(confirmMsg)
        setMenuState("confirm")

        const delayMenuConfirm = (confirmMsg.length / 10) * 1000 / speechRate + 500
        setTimeout(() => {
          setMicState("off")
          startListening()
        }, delayMenuConfirm)
      }
    }
  }

  const executeCurrentAction = () => {
    if (!pendingAction) {
      setMicState("off")
      return
    }

    const [type, value] = pendingAction.split(":")

    if (type === "model") {
      const modelNames: Record<string, string> = {
        "gemma4:e2b": "구글 이기가",
        "gemma4:e4b": "구글 사기가",
        "llama3.2-vision:11b-instruct-q4_K_M": "라마비전",
        "qwen3.5:9b": "큐쓰리",
        "richardyoung/olmocr2:7b-q8": "올름오씨알",
        "glm-ocr": "지엘엠"
      }

      let message = ""
      if (value === "llama3.2-vision:11b-instruct-q4_K_M") {
        message = "라마비전으로 분석할게요. 조금 시간이 걸릴 수 있어요. 최대 10분 정도요. 음악 들으시면서 편하게 기다려 주세요."
      } else {
        message = `${modelNames[value]}으로 분석 시작할게요. 잠시만 기다려 주세요.`
      }

      speak(message)

      setMenuState("idle")
      setMicState("processing")

      // TTS 끝난 후 BGM + 분석 시작
      const delay = (message.length / 10) * 1000 / speechRate + 500
      console.log("[executeCurrentAction] TTS 끝난 후 BGM 시작 예정, delay:", delay)
      setTimeout(() => {
        // BGM 시작
        console.log("[executeCurrentAction] BGM 시작 시도")
        bgmManager.start(speechRate)

        // 파일 분석 시작
        if (pendingFile) {
          console.log("[executeCurrentAction] 파일 분석 시작:", pendingFile.name)
          window.dispatchEvent(new CustomEvent("startAnalysis", { detail: { file: pendingFile, model: value } }))
          setPendingFile(null)
        } else {
          console.log("[executeCurrentAction] pendingFile 없음")
        }
      }, delay)

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
          시각장애인을 위한 AI 음성 도우미
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
          }}
        >
          {[1, 1.2, 1.5, 2].map((rate) => (
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
            onResult={(text, original) => {
              // BGM 중지
              console.log("[onResult] 분석 완료, BGM 중지")
              bgmManager.stop()
              setResponse(text)
              setMicState("speaking")

              // 영문 원본이 있으면 저장
              if (original) {
                setOriginalText(original)
              }

              // 분석 완료 안내 → 결과 읽기 → 후속 안내 (onEnd 콜백으로 연결)
              tts.speak("분석이 끝났어요! 읽어드릴게요.", speechRate, () => {
                // 결과 텍스트 읽기
                tts.speak(text, speechRate, () => {
                  // 텍스트 읽기가 끝난 후
                  if (original && original.length > 10) {
                    // 원문이 있으면 원문 듣기 제안
                    const askMsg = "원문도 들으시겠어요? 스페이스바를 누르고 네 또는 아니오로 말씀해 주세요."
                    setMenuState("ask_original")
                    tts.speak(askMsg, speechRate, () => {
                      setMicState("off")
                      startListening()
                    })
                  } else {
                    // 원문이 없으면 다른 모델 선택 안내
                    const msg = "다른 모델로도 분석 가능합니다. 모델을 바꾸시려면 '모델 바꿔'라고 말씀해 주세요."
                    tts.speak(msg, speechRate, () => {
                      setMicState("off")
                      setMenuState("idle")
                    })
                  }
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
              const msg = "파일이 선택됐어요. 어떤 모델로 분석해 드릴까요?"
              speak(msg)
              const delay1 = (msg.length / 10) * 1000 / speechRate + 300
              setTimeout(() => {
                speak(MODEL_MENU_TTS)
                setMenuState("model_select")
                setMicState("off")
              }, delay1)
            }}
          />
        </div>

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
