# app/page.tsx 구조 진단 보고서

**작성일**: 2026-05-15  
**대상 파일**: `app/page.tsx` (1281 lines)  
**목적**: Push-to-Talk 방식 전환 및 타임아웃 핸들러 수정 전 영향 분석

---

## 1. 현재 주요 함수 목록과 역할

### 핵심 함수 (9개)

| 함수명 | 라인 | 역할 | 타입 |
|--------|------|------|------|
| `speak` | 174 | TTS 재생 래퍼 (Web Speech API) | useCallback |
| `startListening` | 199 | 마이크 ON + 안내 멘트 | useCallback |
| `stopListening` | 210 | 마이크 OFF | useCallback |
| `handleSingleSpace` | 332 | 스페이스 1회: 마이크 토글 | useCallback |
| `handleDoubleSpace` | 352 | 스페이스 2회: 메인 메뉴 | useCallback |
| `loadFileByName` | 415 | 음성으로 파일명 선택 | async function |
| `executeAnalysis` | 473 | 파일 분석 실행 | useCallback |
| `handleVoiceResult` | 487 | **STT 결과 처리 메인 함수** | async function |
| `doChat` | 958 | LLM 채팅 처리 | async function |

### 함수별 상세 역할

**speak (line 174)**
- Web Speech API `SpeechSynthesisUtterance` 래퍼
- 파라미터: `text`, `rate`, `pitch`, `onEnd`
- 호출 횟수: **50+ 곳**
- 특징: 세션 타이머 리셋 포함

**handleSingleSpace (line 332)**
- 현재 동작: **토글 방식**
  - listening 상태 → OFF
  - 그 외 → ON
- TTS 중단: `window.speechSynthesis.cancel()`
- 의존성: `stt` 객체

**handleDoubleSpace (line 352)**
- TTS/BGM 중단
- 마이크 OFF
- 메인 메뉴로 이동
- `MAIN_MENU_TTS` 재생

**handleVoiceResult (line 487-957)**
- **가장 큰 함수** (470줄)
- 모든 음성 명령어 처리
- 정규식 패턴 매칭
- 메뉴 상태별 분기 처리

---

## 2. 스페이스바 관련 Ref 목록

### 선언 위치 (line 86-88)
```typescript
const lastSpaceTimeRef = useRef<number>(0)
const spaceCountRef = useRef<number>(0)
const spaceTimerRef = useRef<NodeJS.Timeout | null>(null)
```

### 사용 위치

**lastSpaceTimeRef**
- line 374: 더블탭 감지 (300ms 이내 확인)
- line 378: 더블탭 처리 후 리셋
- line 383: 현재 시간 저장

**spaceCountRef**
- line 375: 더블탭 시 2로 설정
- line 379: 더블탭 처리 후 0으로 리셋
- line 384: 싱글탭 시 1로 설정
- line 389: 싱글탭 확인
- line 393: 처리 후 0으로 리셋

**spaceTimerRef**
- line 376: 기존 타이머 클리어 (더블탭 시)
- line 387: 기존 타이머 클리어 (새 입력 시)
- line 388: 300ms 타이머 설정 (싱글탭 처리 대기)

### 더블탭 감지 로직 (line 373-381)
```typescript
if (now - lastSpaceTimeRef.current < 300) {
  // 더블탭 감지
  spaceCountRef.current = 2
  if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current)
  handleDoubleSpace()
  lastSpaceTimeRef.current = 0
  spaceCountRef.current = 0
  return
}
```

---

## 3. TTS 관련 호출 경로

### speak() 호출 위치 (50+ 곳)

**주요 호출 패턴:**

1. **음성 명령 응답** (가장 많음)
   - line 500: "멈췄어요"
   - line 507/509: "다시" 명령
   - line 526/530: 음성 선택 (선희)
   - line 545/548: 음성 선택 (인준)
   - line 658: 기본 모델 선택
   - line 837/838: BGM 제어
   - line 856: 처음으로
   - line 862/869/877: 종료 인사

2. **파일 처리**
   - line 432: 파일 선택 확인
   - line 438/468: 파일 읽기 실패
   - line 458: 모델 선택 메뉴

3. **메뉴 안내**
   - line 324: 모델 추천 안내
   - line 359: 메인 메뉴 (MAIN_MENU_TTS)
   - line 590: 음악 선택 메뉴
   - line 842: 음악 요청 안내

4. **세션 관리**
   - line 275: **세션 타임아웃 안내** ⚠️
   - line 200: 초기 "네, 말씀해 주세요"

5. **속도 조절**
   - line 674/680: 배속 변경 안내
   - line 1100: 읽기 속도 변경

### tts.speak() 호출 (Edge TTS 직접 호출)
- line 1203: "분석이 끝났어요!"
- line 1205: 분석 결과 텍스트 읽기
- line 1208: 피드백 요청

**특징**: FileUpload 컴포넌트 결과 처리 시에만 `tts.speak()` 직접 호출

---

## 4. STT 관련 호출 경로

### stt.startListening() 호출 위치 (13곳)

| 라인 | 컨텍스트 | onEnd 콜백 |
|------|----------|-----------|
| 203 | startListening() 함수 내부 | speak() 후 |
| 279 | **세션 타임아웃 후 재시작** ⚠️ | speak() 후 200ms |
| 346 | handleSingleSpace (토글 ON) | playMicOn() 후 200ms |
| 461 | 모델 선택 메뉴 안내 후 | speak() 후 |
| 724 | 파일 목록 안내 후 | speak() 후 |
| 790 | 문서 파일 목록 안내 후 | speak() 후 |
| 846 | 음악 요청 안내 후 | 200ms 후 |
| 1234 | 이미지 인식 후 모델 선택 | speak() 후 |

### stt.stopListening() 호출 위치 (3곳)

| 라인 | 컨텍스트 | 목적 |
|------|----------|------|
| 211 | stopListening() 함수 내부 | 수동 중지 |
| 337 | handleSingleSpace (토글 OFF) | 마이크 OFF |
| 356 | handleDoubleSpace (메인 메뉴) | 전체 리셋 |

---

## 5. 절대 건드리면 안 되는 부분

### 🔴 Critical: 수정 시 앱 전체 작동 불능

1. **handleVoiceResult 함수 구조** (line 487-957)
   - 470줄의 거대 함수
   - 모든 음성 명령어 처리 로직
   - 정규식 패턴 순서 중요 (먼저 매칭된 것 실행)
   - 메뉴 상태별 분기 로직

2. **speak 함수 시그니처** (line 174)
   ```typescript
   const speak = useCallback((
     text: string, 
     rate?: number, 
     pitch: number = 1.7, 
     onEnd?: () => void
   ) => { ... }, [speechRate])
   ```
   - 50+ 곳에서 호출
   - 파라미터 순서/타입 변경 금지

3. **세션 타이머 연동** (line 492)
   ```typescript
   sessionManager.resetTimer()
   ```
   - handleVoiceResult 시작 부분
   - 모든 사용자 활동 감지
   - 제거 시 타임아웃 작동 안 함

4. **FileUpload 컴포넌트 결과 처리** (line 1185-1240)
   - onResult 콜백
   - 분석 완료 후 TTS 체인
   - BGM 관리 포함

### 🟡 Warning: 신중히 수정 필요

1. **micStateRef / menuStateRef 동기화**
   - useState + useRef 이중 관리
   - useEffect 의존성 배열에 포함 불가 → ref 사용
   - 변경 시 양쪽 모두 업데이트 필요

2. **STT 결과 처리 useEffect** (line 402-413)
   ```typescript
   useEffect(() => {
     if (!stt.isListening && stt.transcript && micStateRef.current === "listening") {
       const transcript = stt.transcript.trim()
       if (!transcript) return
       
       console.log("[STT] 결과:", transcript, "메뉴상태:", menuStateRef.current)
       setMicState("processing")
       handleVoiceResult(transcript)
     }
   }, [stt.isListening, stt.transcript])
   ```
   - STT 종료 후 자동 처리
   - `!stt.isListening` 조건 중요

---

## 6. Push-to-Talk 수정 시 영향 분석

### ✅ 영향받는 코드 (수정 필요)

**삭제 대상:**
1. **lastSpaceTimeRef, spaceCountRef, spaceTimerRef** (line 86-88)
2. **handleSingleSpace 함수** (line 332-349)
3. **handleDoubleSpace 함수** (line 352-360)
4. **더블탭 감지 로직** (line 373-381, 388-394)

**수정 대상:**
1. **스페이스바 이벤트 핸들러** (line 363-400)
   - keydown → keyup 추가
   - 더블탭 타이머 제거
   - TTS 재생 중 확인 로직 추가

**추가 필요:**
- TTS 재생 상태 확인: `tts.isSpeaking`
- keydown에서 TTS 중지: `tts.stop()`

### ❌ 영향받지 않는 코드 (그대로 유지)

1. **handleVoiceResult 전체** (line 487-957)
   - STT 결과 처리 로직
   - 음성 명령어 매칭
   - 메뉴 상태 전환

2. **speak 함수** (line 174-197)
   - TTS 재생 로직
   - onEnd 콜백 체인

3. **STT 결과 처리 useEffect** (line 402-413)
   - 자동 처리 로직

4. **세션 타임아웃 핸들러** (line 254-306)
   - 타임아웃 감지 및 안내

5. **모든 음성 명령어 처리**
   - "멈춰", "다시", "처음으로" 등
   - 정규식 패턴 매칭

### 🔄 간접 영향 (동작 변경 필요 없음)

1. **micStateRef 참조**
   - Push-to-Talk에서도 동일하게 사용
   - listening/off 상태만 존재하면 됨

2. **playMicOn/playMicOff**
   - 띠링 소리 재생
   - keydown/keyup에서 호출

---

## 7. 타임아웃 핸들러 수정 시 영향 분석

### ✅ 영향받는 코드 (수정 필요)

**수정 대상:**
1. **sessionTimeout 이벤트 핸들러** (line 254-306)
   - line 275-285: 타임아웃 안내 후 마이크 켜는 부분
   - 10초 타이머 추가 필요

**추가 필요:**
1. **새로운 Ref**
   ```typescript
   const timeoutMicTimerRef = useRef<NodeJS.Timeout | null>(null)
   ```

2. **handleVoiceResult 시작 부분**
   - 타이머 클리어 로직 추가
   ```typescript
   // 타임아웃 마이크 타이머 클리어
   if (timeoutMicTimerRef.current) {
     clearTimeout(timeoutMicTimerRef.current)
     timeoutMicTimerRef.current = null
   }
   ```

### ❌ 영향받지 않는 코드

1. **모든 다른 STT 호출 경로** (13곳)
   - 일반 음성 입력은 그대로
   - 타임아웃 안내 후에만 10초 제한

2. **세션 타이머 자체**
   - sessionManager 로직 변경 없음
   - 타임아웃 감지 로직 그대로

3. **handleVoiceResult 내부 로직**
   - 음성 명령어 처리는 동일
   - 타이머 클리어만 추가

---

## 8. 코드 품질 이슈

### 🔴 발견된 문제

1. **handleVoiceResult 함수 크기** (470줄)
   - 단일 책임 원칙 위반
   - 테스트 어려움
   - 향후 리팩토링 권장

2. **중복 코드**
   - speak() 호출 패턴 반복
   - 파일 목록 처리 로직 중복 (line 688-750, 754-810)

3. **매직 넘버**
   - 300ms (더블탭 감지)
   - 200ms (마이크 ON 딜레이)
   - 10000ms (타임아웃 제한 - 계획 중)

### 🟢 잘 된 부분

1. **Ref를 통한 상태 동기화**
   - micStateRef/menuStateRef 패턴
   - useEffect 무한 루프 방지

2. **명확한 음성 명령어 패턴**
   - VOICE_COMMANDS 상수 분리
   - 정규식 가독성

3. **콜백 체인**
   - speak() onEnd 활용
   - 비동기 흐름 제어

---

## 9. 수정 권장 순서

### Phase 1: Push-to-Talk (우선순위 높음)
1. 새 Ref 없음 (기존 삭제만)
2. 스페이스바 핸들러 재작성 (keydown + keyup)
3. handleSingleSpace/handleDoubleSpace 삭제
4. 더블탭 관련 Ref 삭제

**예상 영향:**
- 수정 라인: ~60줄
- 삭제 라인: ~30줄
- 추가 라인: ~40줄

### Phase 2: 타임아웃 핸들러 (우선순위 중간)
1. timeoutMicTimerRef 추가
2. sessionTimeout 핸들러 수정 (10초 타이머)
3. handleVoiceResult에 타이머 클리어 추가

**예상 영향:**
- 수정 라인: ~15줄
- 추가 라인: ~10줄

---

## 10. 테스트 계획

### Push-to-Talk 테스트 항목
- [ ] 스페이스바 누르는 동안만 마이크 ON
- [ ] 스페이스바 뗄 때 마이크 OFF + STT 처리
- [ ] TTS 재생 중 스페이스바 = 즉시 중지
- [ ] TTS 재생 안 할 때 스페이스바 = 마이크 ON
- [ ] INPUT/TEXTAREA에서는 작동 안 함

### 타임아웃 핸들러 테스트 항목
- [ ] 세션 타임아웃 후 안내 멘트 재생
- [ ] 안내 후 마이크 켜짐
- [ ] 10초 안에 응답 → 타이머 클리어
- [ ] 10초 후 응답 없음 → 마이크 자동 OFF
- [ ] "응답이 없어서..." 안내 재생

---

## 결론

**안전성 평가:** ⚠️ 중간 위험
- Push-to-Talk 수정은 격리된 영역 (스페이스바 핸들러만)
- 타임아웃 수정은 최소 침습 (타이머 추가만)
- handleVoiceResult는 건드리지 않음

**권장 사항:**
1. Push-to-Talk 먼저 구현 및 테스트
2. 타임아웃 핸들러는 별도 커밋
3. 각 수정 후 전체 음성 명령어 테스트
4. 롤백 가능하도록 git 브랜치 분리 권장

**비상 복구 방법:**
- 수정 전 현재 커밋 기록: `4244960`
- 문제 발생 시: `git revert HEAD` 또는 특정 파일만 복구
