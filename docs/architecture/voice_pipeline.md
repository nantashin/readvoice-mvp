# 음성 파이프라인 (Voice Pipeline)

## 개요

READ VOICE Pro의 음성 파이프라인은 다음 3단계로 구성됩니다:

```
마이크
  ↓ (Web Speech API - STT)
사용자 입력 (한국어 텍스트)
  ↓
LLM 처리 (exaone3.5 또는 Claude)
  ↓
응답 텍스트
  ↓ (Web Speech API - TTS)
스피커로 음성 재생
```

---

## 1단계: 음성 입력 (STT)

### 구현 위치
- **파일:** `lib/speech/stt.ts` (Web Speech API)
- **사용:** `app/page.tsx`, `app/api/chat`

### 동작 원리

#### Web Speech API (ko-KR)
```typescript
const recognition = new webkitSpeechRecognition()
recognition.lang = "ko-KR"
recognition.interimResults = true
recognition.continuous = false

recognition.onstart = () => {
  // 마이크 활성화
}

recognition.onresult = (event) => {
  let interimTranscript = ""
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript
    
    if (event.results[i].isFinal) {
      console.log("최종:", transcript) // 사용자 입력
    } else {
      interimTranscript += transcript // 실시간 표시 (선택)
    }
  }
}

recognition.onerror = (event) => {
  console.error("STT 오류:", event.error)
}
```

### 특징

| 특징 | 설명 |
|------|------|
| **언어** | ko-KR (한국어) |
| **입력 방식** | 마이크 (권한 필요) |
| **비용** | 무료 (브라우저 내장) |
| **지연 시간** | ~500ms (마이크 권한 요청 포함) |
| **정확도** | 브라우저/OS 의존 (Chrome 권장) |

### 장점
- ✓ 외부 API 불필요
- ✓ 사용자 명시적 시작 (누른 후 말함)
- ✓ 정확한 한국어 인식

### 제한사항
- ❌ 백그라운드 리스닝 불가
- ❌ 필터링/노이즈 제거 제한적
- ❌ 사용자 마이크 권한 필수

---

## 2단계: LLM 처리

### 구현 위치
- **파일:** `lib/llm/index.ts`
- **모델:** exaone3.5:2.4b (기본), claude-haiku-4-5 (폴백)

### 동작 흐름

```
사용자 입력 (한국어)
  ↓
chatOllama() 호출 (exaone3.5)
  ↓ 메시지 히스토리 포함
실시간 응답 스트리밍 (선택)
  ↓ 수집
완전한 응답 텍스트
  ↓
Claude API 폴백 (필요 시)
  ↓
응답 텍스트
```

### EXAONE 처리 (기본)

#### 설정
```typescript
// lib/llm/index.ts
const chatOllama = new ChatOllama({
  model: "exaone3.5:2.4b",
  baseUrl: "http://localhost:11434",
  temperature: 0.7,
})
```

#### 특징
| 특징 | 값 |
|------|-----|
| **모델** | exaone3.5:2.4b (한국 개발) |
| **특화** | 한국어 이해/생성 |
| **속도** | 빠름 (2.4B 파라미터) |
| **메모리** | ~6GB |
| **응답 시간** | ~1~3초 |

### Claude API 폴백

#### 언제 사용?
1. EXAONE이 실패한 경우
2. 구체적인 지시사항이 필요한 경우
3. 복잡한 논리/계산 필요 시

#### 설정
```typescript
const chatClaude = new ChatAnthropic({
  modelName: "claude-haiku-4-5",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
})
```

#### 특징
| 특징 | 값 |
|------|-----|
| **모델** | claude-haiku-4-5 |
| **특화** | 영어 중심 (한국어 지원) |
| **응답 시간** | ~2~5초 |
| **비용** | 호출 당 요금 |

### 구현 패턴

```typescript
async function chat(userMessage: string): Promise<string> {
  try {
    // EXAONE 시도
    const response = await chatOllama.call([
      new HumanMessage(userMessage)
    ])
    return response.content
  } catch (e) {
    console.error("[Chat] EXAONE 실패:", e)
    
    try {
      // Claude 폴백
      const response = await chatClaude.call([
        new HumanMessage(userMessage)
      ])
      return response.content
    } catch (e2) {
      console.error("[Chat] Claude 실패:", e2)
      throw new Error("LLM 처리 실패")
    }
  }
}
```

### 대화 메모리

```typescript
// 메시지 히스토리 유지 (컨텍스트)
const conversationHistory = [
  new HumanMessage("안녕하세요"),
  new AIMessage("안녕하세요! 무엇을 도와드릴까요?"),
  new HumanMessage("사진 분석해줄 수 있어?"),
  // ...
]

// 새 메시지 추가
conversationHistory.push(new HumanMessage(userMessage))
const response = await chat(conversationHistory)
conversationHistory.push(new AIMessage(response))
```

---

## 3단계: 음성 출력 (TTS)

### 구현 위치
- **파일:** `lib/speech/tts.ts`
- **사용:** `app/page.tsx` (useSpeechSynthesis hook)

### 동작 원리

#### Web Speech API (SpeechSynthesis)
```typescript
export function useSpeechSynthesis() {
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "ko-KR"
    utterance.rate = 1.0 // 속도 1배
    utterance.pitch = 1.0 // 음역대 중간
    utterance.volume = 1.0 // 최대 음량
    
    utterance.onstart = () => {
      console.log("[TTS] 음성 재생 시작")
    }
    
    utterance.onend = () => {
      console.log("[TTS] 음성 재생 완료")
    }
    
    speechSynthesis.speak(utterance)
  }
  
  return { speak }
}
```

### 특징

| 특징 | 설명 |
|------|------|
| **언어** | ko-KR (한국어) |
| **음성** | OS 기본 음성 (변경 불가) |
| **비용** | 무료 (브라우저 내장) |
| **지연 시간** | <100ms (준실시간) |
| **품질** | 자연스러운 한국어 음성 |

### 설정 옵션

```typescript
utterance.rate = 1.0  // 0.1 ~ 10.0 (기본 1.0)
utterance.pitch = 1.0 // 0 ~ 2.0 (기본 1.0)
utterance.volume = 1.0 // 0 ~ 1.0 (기본 1.0)
```

### 장점
- ✓ 외부 API 불필요
- ✓ 자연스러운 음성
- ✓ 즉시 재생 가능

### 제한사항
- ❌ 음성 변경 불가 (OS 음성만 사용)
- ❌ 장시간 텍스트는 여러 번 호출 필요
- ❌ 음성 저장 불가 (재생만)

---

## 전체 플로우

### 사용자 관점
```
1. 마이크 아이콘 클릭
   ↓ (STT 준비)
2. "사진 분석해줄 수 있어?" (음성 입력)
   ↓ (Web Speech API)
3. 텍스트 인식: "사진 분석해줄 수 있어?"
   ↓ (서버로 전송)
4. LLM 처리: EXAONE → 응답 생성
   ↓
5. "네, 사진을 업로드하면 분석해드리겠습니다."
   ↓ (TTS 재생)
6. 스피커로 음성 들음
   ↓
7. 완료, 다시 대기
```

### 기술적 상세 흐름
```
Frontend                Backend
   ↓                      ↓
1. UI 초기화
   ↓
2. 마이크 활성화
   (Web Speech API)
   ↓
3. 사용자 음성 입력
   (STT)
   ↓
4. 텍스트 전송
   (FormData POST)
                    5. /api/chat 처리
                       ↓
                    6. lib/llm/index.ts
                       EXAONE 호출
                       ↓
                    7. 응답 생성
                       ↓
                    8. 응답 반환
   ↓
9. JSON 수신
   ↓
10. TTS 재생
    (Web Speech API)
    ↓
11. 사용자 청취
    ↓
12. 이벤트 처리
    (onStatusChange)
```

---

## 에러 처리

### STT 오류
```typescript
recognition.onerror = (event) => {
  switch (event.error) {
    case "no-speech":
      tts.speak("음성이 감지되지 않았습니다. 다시 시도해주세요.")
      break
    case "audio-capture":
      tts.speak("마이크 접근 권한이 없습니다.")
      break
    case "network":
      tts.speak("네트워크 오류가 발생했습니다.")
      break
  }
}
```

### LLM 오류
```typescript
try {
  const response = await chatOllama.call([...])
} catch (e) {
  // EXAONE 실패 → Claude 폴백
  // Claude도 실패 → 사용자에게 알림
  tts.speak("처리 중 오류가 발생했습니다. 다시 시도해주세요.")
}
```

### TTS 오류
```typescript
utterance.onerror = (event) => {
  console.error("[TTS] 오류:", event.error)
  // 재시도 또는 대체 방법 없음 (브라우저 한계)
}
```

---

## 성능 최적화

### 응답 시간 단축
1. **EXAONE 우선:** ~1~3초 (기본)
2. **Claude 폴백:** ~2~5초 (필요 시만)
3. **캐싱:** 동일 질문 재사용 (선택)

### 배터리 절약
- Web Speech API: 실시간 처리 (배경 음성 X)
- TTS: 필요 시에만 재생

### 네트워크 절약
- 로컬 EXAONE 사용 (대역폭 절약)
- Claude는 폴백 전용 (불필요한 호출 X)

---

## 제한사항 및 개선 방안

| 제한사항 | 현재 상황 | 개선 방안 |
|---------|---------|---------|
| STT 정확도 | 브라우저 의존 | Google Cloud Speech-to-Text API |
| LLM 다국어 | EXAONE은 한국어 특화 | 다국어 모델 추가 (LLAMA 등) |
| TTS 음성 선택 | 단일 음성 | Azure TTS (다양한 음성) |
| 실시간 처리 | 순차 처리 | 스트리밍 응답 구현 |
| 오프라인 | EXAONE만 가능 | 전체 오프라인 지원 |

---

## 사용 예시

### 간단한 대화
```
사용자: "안녕하세요"
EXAONE: "안녕하세요! 저는 READ VOICE입니다. 무엇을 도와드릴까요?"

사용자: "날씨가 어떻게 되나요?"
EXAONE: "죄송하지만 실시간 날씨 정보는 제공할 수 없습니다. 날씨 앱을 확인해주세요."
```

### 파일 분석 전 대화
```
사용자: "사진을 분석할 수 있나요?"
EXAONE: "네, 이미지나 PDF를 업로드하면 자동으로 분석해드립니다. 파일을 선택해주세요."

사용자: "한글로 설명해줄 수 있어?"
EXAONE: "물론입니다! 모든 설명은 한국어로 제공됩니다."
```

---

## 결론

READ VOICE Pro의 음성 파이프라인은 Web Speech API를 활용하여 **접근성 높고 간단한 음성 인터페이스**를 제공합니다.

- **STT:** 사용자의 음성을 한국어로 인식
- **LLM:** EXAONE으로 빠른 응답 (Claude 폴백)
- **TTS:** 자연스러운 한국어 음성 재생

이 3단계는 시각 장애인뿐만 아니라 모든 사용자에게 손/눈 없이 애플리케이션을 완전히 사용할 수 있는 경험을 제공합니다.
