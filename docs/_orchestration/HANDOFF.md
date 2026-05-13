# Session Handoff

**마지막 업데이트:** 2026-05-13  
**현재 버전:** v2.8.3  
**다음 버전 목표:** v2.9.0 (Phase 2 완성)

---

## 완료된 작업

### ✅ 음성 파일 선택 시스템 (v2.8.x)
- "이미지 분석해줘" → 자동으로 폴더 열림
- 파일 목록 TTS 읽기
- 파일명 또는 번호로 음성 선택
- 모델 선택 → 분석 실행

### ✅ 세션 관리 최적화
- SESSION_TIMEOUT: 60초 → 10분 (600000ms)
- FEEDBACK_WINDOW: 10초 → 30초 (30000ms)
- 파일 자동 삭제 로직 완전 제거 (사용자 작업 공간 보호)

### ✅ MenuState 확장
- "loading" 상태 추가 (중복 프롬프트 방지)
- 추천 타이머 관리 (recommendTimerRef)
- 파일명 정규화 (공백 제거)

### ✅ 빌드 검증
- TypeScript 컴파일 성공
- 모든 API 라우트 정상
- CI 워크플로우 추가

---

## 다음에 할 일

### [우선순위 1] 음성 명령 종단간 테스트
- 실제 음성으로 전체 플로우 검증
- 파일 선택 정확도 체크
- 모델 선택 음성 인식 확인

### [우선순위 2] 이미지 프롬프트 8종 적용
- **사진 3종:** 인물/풍경/일반 사진
- **문서 3종:** 스캔문서/손글씨/표/차트
- **혼합 2종:** 인포그래픽/광고 이미지

### [우선순위 3] v2.9.0 릴리스 준비
- Phase 2 완성본 최종 검증
- VERSION_HISTORY.md 업데이트
- Phase 3 (웹 검색) 기획 시작

---

## 막힌 부분

### /api/open-folder 500 에러
- **증상:** POST 요청 시 500 에러 로그 발생
- **현재 상태:** 기능은 정상 작동 (폴더가 열림)
- **우선순위:** 낮음 (차후 수정)
- **추정 원인:** execAsync 프로세스 종료 시점 이슈

---

## 다음 세션에 알려줄 것

1. **v2.8.3 완성:** CI, orchestration 추가, IYE:V2V 전환 준비 완료
2. **Phase 2 마무리 단계:** 음성 명령 테스트와 프롬프트 최적화만 남음
3. **Phase 3 준비:** 웹 검색 기능 (YouTube, Google) 설계 필요
4. **세션 타임아웃 연장:** 사용자가 충분한 시간을 가지고 작업할 수 있도록 10분으로 설정됨

---

## 컨텍스트 복구용 핵심 정보

### 프로젝트 구조
```
app/page.tsx - 메인 UI + 음성 로직 (MenuState 14번째 줄)
lib/session/session-manager.ts - 세션 타임아웃 관리
app/api/watch-folder/route.ts - 파일 목록 반환
app/api/read-file/route.ts - 파일 Base64 변환
app/api/open-folder/route.ts - Windows 탐색기 실행
```

### 환경 변수
```
UPLOAD_FOLDER_PATH=C:/Users/tara0/readvoice-mvp/public/ReadVoice_Upload
```

### 중요 규칙
- **파일 삭제 절대 금지** (사용자 작업 공간)
- **any 타입 금지** (TypeScript strict mode)
- **LLM 호출은 lib/llm/index.ts 경유** (중앙화)
- **접근성 필수** (aria-label 필수, 음성 우선)
- **장애 언급 금지** (patronizing 방지)
