# Codex Review - PDF OCR 문제

## 검토 요청

### 문제
PDF OCR이 계속 실패함.
pypdfium2로 PNG 변환 후 GLM-OCR 호출해야 하는데
매번 수정해도 PDF 버퍼를 직접 넘기는 문제 반복됨.

### 관련 파일
- `modules/ocr/pdf.ts` - PDF 처리 메인 로직
- `modules/ocr/ocr-engine.ts` - GLM-OCR 호출 엔진
- `server/glm-ocr.py` - Python GLM-OCR 스크립트
- `server/pdf-to-image.py` - pypdfium2 변환 스크립트

### 확인된 사실
1. `server/glm-ocr.py` 직접 실행 → **완벽 작동**
2. `server/pdf-to-image.py` 직접 실행 → **완벽 작동**
3. 앱에서 호출 시 → PDF 버퍼가 PNG 변환 없이 바로 GLM-OCR로 전달됨

### 현재 구현 상태

#### modules/ocr/pdf.ts
```typescript
// 1단계: 텍스트 PDF 파싱 시도
extractRawText(buffer) 
→ 한글 10자 이상이면 바로 반환

// 2단계: 스캔 PDF → pypdfium2 변환
tmpPdf 저장
→ pdf-to-image.py 호출
→ tmpPng 생성
→ pngBuffer 읽기
→ extractTextOCR(pngBuffer, "image/png", name)
```

#### modules/ocr/ocr-engine.ts
```typescript
export async function extractTextOCR(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<string>

// tmpImg에 buffer 저장
// glm-ocr.py 호출 (tmpImg 경로 전달)
// JSON 파싱 → 결과 반환
// 실패 시 에러
```

#### server/glm-ocr.py
```python
def run_glm_ocr(image_path: str) -> str:
    result = subprocess.run(
        ["ollama", "run", "glm-ocr",
         "이 문서의 모든 텍스트를 정확히 읽어줘",
         image_path],
        capture_output=True,
        text=True,
        timeout=60,
        encoding="utf-8"
    )
    return clean_text(result.stdout.strip())

# ANSI 코드 제거, 공백 정리
```

#### server/pdf-to-image.py
```python
def pdf_to_image(pdf_path, page_num=0, output_path=None, dpi=200):
    # output_path가 있으면 PNG 파일로 저장
    # 없으면 base64 JSON 출력
```

### 의심되는 지점

1. **pdf.ts의 파싱 로직이 먼저 실행되어 성공하는 경우**
   - extractRawText가 한글 10자 이상 추출하면 바로 반환
   - pypdfium2 변환이 실행되지 않음

2. **extractTextOCR에 잘못된 buffer 전달**
   - PDF buffer를 PNG로 변환하지 않고 직접 전달?
   - mimeType이 "image/png"지만 실제로는 PDF 데이터?

3. **Python 스크립트 경로 문제**
   - 스크립트가 실행되지 않거나 실패하는 경우
   - 로그를 확인해야 함

### 요청

1. **modules/ocr/pdf.ts 전체 로직 점검**
   - extractRawText 조건 강화 (한글 10자 → 50자 이상?)
   - pypdfium2 변환 성공 여부 확실히 검증
   - pngBuffer가 실제로 PNG인지 확인

2. **pypdfium2 변환 → GLM-OCR 연결 확인**
   - tmpPng 파일이 실제로 생성되는지
   - pngBuffer 읽기가 성공하는지
   - extractTextOCR에 올바른 PNG buffer 전달되는지

3. **불필요한 fallback 코드 제거**
   - olmOCR-2, qwen2.5vl API 호출 완전 제거 (완료)
   - 단일 경로만 유지: PDF → PNG → GLM-OCR

4. **깔끔하게 재작성**
   - 단계별 로그 강화
   - 각 단계 성공/실패 명확히 구분
   - 에러 메시지 구체화

### 테스트 방법

```bash
# 1. Python 스크립트 직접 테스트
python server/pdf-to-image.py test.pdf 0 test.png
python server/glm-ocr.py test.png

# 2. Node.js에서 테스트
npm run dev
# PDF 업로드 후 콘솔 로그 확인:
# - [PDF] 텍스트 파싱 시도...
# - [PDF] pypdfium2로 PDF → PNG 변환...
# - [PDF] 변환 결과: 0 {...}
# - [PDF] PNG 변환 성공, GLM-OCR 시작...
# - [OCR] 버퍼 크기: ... bytes
# - [OCR] 스크립트 존재: true
# - [OCR] exit code: 0
# - [OCR] GLM-OCR 성공: ... 자
```

### 예상 원인

**가장 가능성 높은 원인:**
extractRawText가 스캔 PDF에서도 한글 10자 이상을 추출하여
pypdfium2 변환이 실행되지 않는 경우.

**해결책:**
1. extractRawText 조건을 강화 (한글 50자 이상)
2. 또는 extractRawText가 추출한 텍스트가 의미 있는지 검증
   (연속된 한글 단어가 있는지, 문장 구조인지 등)

### 다음 단계

1. 실제 PDF 파일로 테스트
2. 각 단계별 로그 확인
3. 어느 단계에서 실패하는지 파악
4. 해당 부분 집중 수정

---

**작성일:** 2026-04-24  
**상태:** 검토 대기 중
