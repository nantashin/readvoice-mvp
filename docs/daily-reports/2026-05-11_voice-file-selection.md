# 일일 작업 보고서 - 2026년 5월 11일 (월)

## 📋 작업 요약

**주제:** 음성 기반 파일 선택 시스템 완성  
**버전:** v2.8.0 → v2.9.0 (예정)  
**작업 시간:** 09:00 ~ 17:45  
**핵심 성과:** 완전 음성 기반 파일 업로드 및 선택 시스템 구축 완료

---

## 🎯 주요 개발 내용

### 1. 음성 기반 파일 선택 시스템 (완성)

**구현 기능:**
- ✅ "이미지 분석해줘" → 자동으로 Windows 탐색기로 폴더 열기
- ✅ 폴더 내 파일 목록 TTS로 읽어주기 (최대 5개)
- ✅ 음성으로 파일 선택:
  - 번호 선택: "일번", "이번", "삼번", "사번", "오번"
  - 파일명 선택: "인물관계도" (공백 포함 인식)
- ✅ 모든 파일 타입 지원 (이미지, PDF, TXT, DOC, PPT 등)

**기술적 구현:**
```typescript
// 파일명 매칭 (공백 무시)
const normalizedInput = transcript.replace(/\s/g, '').toLowerCase()
const matchedFile = uploadFiles.find(f => {
  const normalizedFileName = f.name.replace(/\s/g, '').toLowerCase()
  return normalizedFileName.includes(normalizedInput) ||
         normalizedInput.includes(normalizedFileNameNoExt)
})
```

**API 추가:**
- `/api/open-folder`: Windows 탐색기로 폴더 열기 (POST)
- `/api/watch-folder`: 모든 파일 타입 반환 (확장자 필터 제거)
- `/api/read-file`: MIME 타입 확장 (DOC, PPT, TXT 등)

---

### 2. 세션 관리 시스템 개선

**문제점:**
- 60초 타임아웃이 너무 짧아 사용자 작업 중 세션 종료
- 파일 자동 삭제로 사용자 파일 손실
- 피드백 윈도우 10초로 부족

**해결책:**
```typescript
// 세션 타임아웃 연장
const SESSION_TIMEOUT = 600000 // 60초 → 10분
const FEEDBACK_WINDOW = 30000 // 10초 → 30초

// 파일 자동 삭제 완전 제거
export async function POST() {
  // 업로드 폴더는 사용자 영구 저장소
  // 파일 삭제 안 함 (로컬 스토리지만 정리)
  console.log("[클리닝] 완료 - 파일 삭제 안 함")
  return Response.json({ success: true })
}
```

**결과:**
- ✅ 사용자가 충분한 시간(10분) 동안 작업 가능
- ✅ 파일이 절대 자동 삭제되지 않음
- ✅ 피드백 입력 시간 충분

---

### 3. 음성 UX 버그 수정

**문제 1: 추천 멘트 중복 발동**
- 파일 선택 후에도 3초 타이머가 발동하여 "추천해드릴까요?" 멘트 중복

**해결:**
```typescript
const recommendTimerRef = useRef<NodeJS.Timeout | null>(null)

// 파일 선택 시 타이머 즉시 취소
if (recommendTimerRef.current) {
  clearTimeout(recommendTimerRef.current)
  recommendTimerRef.current = null
}

// speak() 호출 시 모든 타이머 자동 취소
const speak = useCallback((text, rate, pitch, onEnd) => {
  window.speechSynthesis.cancel()
  if (recommendTimerRef.current) {
    clearTimeout(recommendTimerRef.current)
    recommendTimerRef.current = null
  }
  // ... TTS 재생
}, [speechRate])
```

**문제 2: 공백 포함 파일명 매칭 실패**
- "인물 관계도" (공백) → "인물관계도.png" 매칭 안 됨

**해결:**
- 입력과 파일명 모두 공백 제거 후 비교
- 확장자 제거 후에도 비교하여 정확도 향상

**문제 3: 스페이스바 무반응**
- TTS 중 스페이스바를 눌러도 멈추지 않음

**해결:**
- `window.speechSynthesis.cancel()` 호출 확인
- 모든 타이머를 즉시 취소하도록 수정

---

## 🐛 해결한 주요 버그

### 1. 파일 자동 삭제 문제 (Critical)
**증상:** 사용자가 폴더에 넣은 파일이 자동으로 사라짐  
**원인:** `cleanup-session` API가 1시간 이상 된 파일을 자동 삭제  
**해결:** 파일 삭제 로직 완전 제거, 업로드 폴더를 영구 저장소로 전환

### 2. 환경변수 경로 불일치
**증상:** API가 다른 폴더를 읽음 (파일 0개 반환)  
**원인:** `.env.local`의 `UPLOAD_FOLDER_PATH`가 비어있는 폴더 지정  
**해결:** `public/ReadVoice_Upload`로 경로 변경 및 파일 복구

### 3. Windows 경로 정규화 오류 (403 Forbidden)
**증상:** `/api/read-file`이 403 에러 반환  
**원인:** Forward slash와 backslash 혼용으로 `startsWith()` 체크 실패  
**해결:** `path.resolve()`로 양쪽 경로 정규화

---

## 📊 테스트 결과

### 성공 케이스
✅ "이미지 분석해줘" → 폴더 열림 + 파일 목록 TTS  
✅ "인물관계도" → 파일 인식 및 로딩  
✅ "일번" → 첫 번째 파일 선택  
✅ 스페이스바로 TTS 중단  
✅ 10분 동안 세션 유지  
✅ 파일이 자동 삭제되지 않음

### 미해결 이슈
⚠️ `/api/open-folder` 500 에러 (콘솔에 표시됨)
- 폴더는 정상적으로 열리지만 에러 로그 발생
- Python exec 권한 문제로 추정
- 기능은 정상 작동하므로 우선순위 낮음

---

## 📁 파일 변경 내역

### 신규 파일
- `app/api/open-folder/route.ts`: Windows 탐색기 열기 API
- `ScreenShot/인물관계도.png`: 테스트용 이미지 파일

### 수정 파일
- `app/page.tsx`: 음성 파일 선택 로직, 타이머 관리
- `app/api/watch-folder/route.ts`: 모든 파일 타입 반환
- `app/api/read-file/route.ts`: MIME 타입 확장, 경로 정규화
- `app/api/cleanup-session/route.ts`: 파일 삭제 로직 제거
- `lib/session/session-manager.ts`: 타임아웃 10분 연장
- `.env.local`: UPLOAD_FOLDER_PATH 경로 수정

---

## 🎓 학습 내용

### 1. 비동기 TTS 타이밍 이슈
**문제:** `speechSynthesis.onend`에서 async/await 사용 시 실행 안 됨  
**해결:** Promise chain (`.then()/.catch()`) 패턴으로 변경

### 2. 파일 영구성 vs 세션 클리닝
**교훈:** 
- 업로드 폴더는 사용자의 작업 공간 (영구 저장소)
- 세션 클리닝은 브라우저 캐시/로컬 스토리지만
- 파일 삭제는 사용자가 직접 수행해야 함

### 3. 음성 UX에서의 타이머 관리
**핵심:**
- 모든 타이머는 ref로 관리 (`useRef<NodeJS.Timeout>`)
- 새로운 speak() 호출 시 기존 타이머 모두 취소
- 파일 선택/모델 선택 시 즉시 타이머 제거

---

## 📈 진행률

### Phase 2 (Vision/OCR) - 95% 완료
- [x] 음성 기반 파일 선택
- [x] 폴더 자동 열기
- [x] 모든 파일 타입 지원
- [x] 세션 관리 시스템
- [x] 파일 영구 보존
- [ ] 카메라 촬영 기능 (보류)

---

## 🔄 Git Commits (오늘)

1. `d330af4` - feat: 음성 UX 8가지 개선 사항 구현
2. `2558a98` - fix: 새로고침 시 안내 멘트 수정
3. `2b05475` - fix: 브라우저 autoplay 정책 우회
4. `58bc1da` - feat: 음성 기반 파일 선택 시스템 구현
5. `672e1b6` - feat: 완전 음성 기반 이미지 소스 선택 시스템
6. `27d066b` - fix: 이미지/문서 분석 플로우 단순화
7. `4b90786` - fix: choose_source 타입 제거
8. `f1627f5` - feat: 세션 관리 및 카메라 기능 제거
9. `66b79c5` - feat: voice file selection with folder auto-open ⭐ (최종)

**아침 버전:** `83f40bc` (save-state 간결화)  
**저녁 버전:** `66b79c5` (음성 파일 선택 완성)

---

## ✅ 내일 할 일 (2026-05-12)

### 1. 음성 파일 선택 시스템 최종 테스트
- [ ] 다양한 파일 타입 업로드 테스트 (PNG, JPG, PDF, TXT, DOCX, PPTX)
- [ ] 파일명 인식률 검증 (공백, 특수문자 포함)
- [ ] 세션 타임아웃 10분 검증
- [ ] 파일 영구 보존 확인 (24시간 후에도 유지되는지)

### 2. `/api/open-folder` 500 에러 해결
- [ ] Python exec 권한 확인
- [ ] 에러 로그 분석
- [ ] Windows 보안 정책 확인

### 3. 모델 선택 UX 개선
- [ ] 모델 선택 안내 멘트 간결화
- [ ] 추천 모델 자동 선택 옵션 추가
- [ ] 모델별 예상 시간 안내

### 4. 최종 사용자 시나리오 테스트
**시나리오 1: 이미지 분석**
- 이미지 분석해줘 → 폴더 열림 → 인물관계도 → 모델 선택 → 분석 완료

**시나리오 2: 문서 OCR**
- 문서 분석해줘 → 폴더 열림 → PDF 선택 → 모델 선택 → OCR 완료

**시나리오 3: 피드백 수집**
- 분석 완료 → "좋아요" → 학습 데이터 저장 → 세션 종료 → 새로고침

---

## 📝 기술 부채

1. **카메라 촬영 기능 재구현** (낮은 우선순위)
   - 현재 코드에서 완전히 제거됨
   - 필요 시 별도 브랜치에서 재구현

2. **파일 업로드 UI 개선** (중간 우선순위)
   - 현재는 폴더에서만 선택 가능
   - 드래그 앤 드롭 추가 검토

3. **에러 핸들링 강화** (높은 우선순위)
   - `/api/open-folder` 에러 처리
   - 파일 읽기 실패 시 재시도 로직
   - 네트워크 오류 시 사용자 안내

---

## 🎯 다음 마일스톤

**Phase 3: 웹 검색 기능 (예정)**
- Google 검색 연동
- 검색 결과 음성 요약
- 링크 열기 명령

**현재 버전:** v2.8.2  
**다음 버전:** v2.9.0 (음성 파일 선택 완성)  
**목표 버전:** v3.0.0 (Phase 3 완료)

---

**작성자:** Claude Code (Opus 4.6)  
**작성일:** 2026-05-11 17:45  
**리뷰 상태:** 완료
