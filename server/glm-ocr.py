import sys
import subprocess
import json
import re

def clean_text(text: str) -> str:
    # ANSI 이스케이프 코드 제거
    ansi_escape = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\[K')
    text = ansi_escape.sub('', text)
    # 연속 공백/줄바꿈 정리
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()

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

if __name__ == "__main__":
    image_path = sys.argv[1]
    text = run_glm_ocr(image_path)
    print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
