# 현재 상태

날짜: 2026-04-24

## 프로젝트 개요
READ VOICE Pro - 시각장애인을 위한 AI 음성 기반 웹 애플리케이션

## 최근 변경 사항
- PDF OCR 파이프라인 완전 재작성
- pdfjs-dist 통합 (Embedded Text 추출)
- GLM-OCR 엔진 안정화
- Windows UTF-8 인코딩 문제 해결
- GGML tensor 크기 오류 수정

## 주요 파일
- `modules/ocr/pdf.ts` - PDF 처리 (embedded text + OCR)
- `modules/ocr/ocr-engine.ts` - OCR 엔진 (GLM-OCR)
- `server/glm-ocr.py` - Python GLM-OCR 스크립트
- `app/api/ocr/route.ts` - API 라우트

## 현재 작동 상태
✅ PDF embedded text 추출
✅ 다중 페이지 OCR (최대 3페이지)
✅ GLM-OCR 통합
✅ 텍스트 품질 검증
✅ Windows 인코딩 문제 해결

## 알려진 이슈
- 없음 (모든 패치 적용 완료)

## 다음 작업
- docs/handoff/next-task.md 참조

## 저장소
https://github.com/nantashin/readvoice-mvp
