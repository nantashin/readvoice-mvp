# READ VOICE Pro 업무일지 2종 자동생성 루틴 설계

## 목적

- 개발용 상세 업무일지: 개발자·다음 세션 인수인계용
- 보고용 요약 업무일지: 윗선 보고·메신저 공유용
- 생성 시각: 매일 20:00, 한국 시간 기준
- 생성 방식: Windows 작업 스케줄러 + PowerShell 스크립트

---

## 1. 자동생성 산출물 구조

```text
readvoice-mvp/
├─ docs/
│  └─ daily-reports/
│     ├─ 2026-04-29.md                  # 개발용 상세 업무일지
│     └─ brief/
│        └─ 2026-04-29-brief.md         # 보고용 요약 업무일지
└─ scripts/
   ├─ daily-report.ps1                  # 기존 개발용 상세 보고서
   ├─ daily-report-brief.ps1            # 신규 보고용 요약 보고서
   └─ generate-daily-logs.ps1           # 두 보고서 통합 실행
```

외부 보관 폴더 병행 저장:

```text
C:\Users\tara0\readvoice-pro-agent\업무일지\YYYY-MM-DD.md
C:\Users\tara0\readvoice-pro-agent\보고용업무일지\YYYY-MM-DD-brief.md
```

---

## 2. 루틴 A — 개발용 상세 업무일지

기존 `scripts/daily-report.ps1` 유지.

포함 항목:

- 금일 커밋 상세 목록
- 기능 추가·버그 수정·문서화 분류
- 변경 파일 전체 목록
- 현재 진행 중인 작업
- 작동 기능 목록
- Phase별 진행률
- 알려진 이슈
- Ollama 모델 목록
- Node/npm/Python/Ollama 환경 정보
- 다음 작업 목록

용도:

- 개발자 확인
- Claude Code 다음 세션 인수인계
- GitHub 커밋 근거 보관
- 상세 변경 이력 추적

---

## 3. 루틴 B — 보고용 요약 업무일지

신규 `scripts/daily-report-brief.ps1` 추가.

보고 형식:

- 문장형 설명 제외
- 구·명사절 중심
- 설치 / 테스트 / 오류 / 수정 / 결과 / 남은 과제 / 내일 업무 / 현재 위치 / 예상 완료일자
- 1페이지 이내
- 메신저·문서 보고에 바로 복사 가능한 형식

보고용 기본 템플릿:

```markdown
# READ VOICE Pro 보고용 업무일지

- 날짜: YYYY-MM-DD
- 프로젝트: READ VOICE Pro MVP
- 현재 위치: 전체 로드맵 NN% / Phase 2 NN%
- 예상 개발 완료일자: YYYY-MM-DD, MVP 기준

## 오늘 업무
- 핵심 기능 구현
- 오류 수정
- 테스트 진행

## 설치
- 개발 환경 유지

## 테스트
- 주요 기능 테스트

## 오류
- 확인된 오류

## 수정
- 수정 사항

## 결과
- 데모 가능 상태

## 남은 과제
- 잔여 과제

## 내일 업무
- 우선순위 작업
```

---

## 4. 통합 실행 스크립트

`generate-daily-logs.ps1`에서 두 스크립트 순차 실행.

```powershell
$Root = "C:\Users\tara0\readvoice-mvp"
Set-Location $Root

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$Root\scripts\daily-report.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$Root\scripts\daily-report-brief.ps1" -ExpectedDoneDate "2026-05-31"
```

선택 옵션:

```powershell
git add docs/daily-reports scripts
git commit -m "chore: 일일 업무일지 자동 생성"
git push
```

자동 커밋은 작업 중간 파일까지 포함될 수 있으므로 초기에는 비활성 권장.

---

## 5. Windows 작업 스케줄러 등록

PowerShell 관리자 권한 실행 후:

```powershell
schtasks /Create /TN "ReadVoice Daily Logs" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\tara0\readvoice-mvp\scripts\generate-daily-logs.ps1" /SC DAILY /ST 20:00 /F
```

권장 설정:

- 트리거: 매일 20:00
- 동작: PowerShell 실행
- 시작 위치: `C:\Users\tara0\readvoice-mvp`
- 조건: 노트북 전원 연결 여부와 무관하게 실행
- 설정: 예약된 시작을 놓친 경우 가능한 빨리 실행
- 권한: 사용자 로그인 여부와 관계없이 실행

---

## 6. Claude Code 연동형 선택 루틴

보고용 문구 품질을 더 높이고 싶을 때만 사용.

방식:

1. `daily-report.ps1`로 개발용 상세 보고서 생성
2. Claude Code에 상세 보고서 전달
3. 보고용 구·명사절 형식으로 재작성
4. `brief` 폴더에 저장

Claude Code 프롬프트 예시:

```text
오늘 생성된 docs/daily-reports/YYYY-MM-DD.md를 읽고,
윗선 보고용 업무일지를 작성해줘.
문장형 설명은 제외하고 구·명사절 중심으로 작성해줘.
항목은 오늘 업무, 설치, 테스트, 오류, 수정, 결과, 남은 과제,
내일 업무, 총 로드맵 중 현재 위치, 예상 개발 완료일자로 구성해줘.
출력 파일은 docs/daily-reports/brief/YYYY-MM-DD-brief.md로 저장해줘.
```

---

## 7. 권장 운영 방식

- 매일 20:00 자동 생성
- 개발용 상세 일지 자동 저장
- 보고용 요약 일지 자동 저장
- 다음 날 오전 보고용 요약본만 복사·공유
- 개발용 상세 일지는 Claude Code 인수인계 자료로 활용
- 주 1회 개발용 상세 일지 기반 로드맵 진행률 재산정

---

## 8. 현재 적용 권장안

- 기존 `scripts/daily-report.ps1` 유지
- 신규 `scripts/daily-report-brief.ps1` 추가
- 신규 `scripts/generate-daily-logs.ps1` 추가
- Windows 작업 스케줄러 20:00 등록
- 자동 커밋은 3일간 수동 확인 후 활성화
