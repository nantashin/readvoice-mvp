import sys
import subprocess
import json
import re
import os

# Windows UTF-8 강제
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def clean_text(text: str) -> str:
    ansi = re.compile(r'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\[K')
    text = ansi.sub('', text)
    text = re.sub(r'[\u2800-\u28FF]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def resize_for_glm(image_path: str) -> str:
    try:
        from PIL import Image
        img = Image.open(image_path)
        w, h = img.size
        new_w = (w // 32) * 32
        new_h = (h // 32) * 32
        if new_w == w and new_h == h:
            return image_path
        resized = image_path.replace('.png', '_r.png')
        img.resize((new_w, new_h), Image.LANCZOS).save(resized)
        return resized
    except:
        return image_path

def run_glm_ocr(image_path: str) -> str:
    safe_path = resize_for_glm(image_path)
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'

    result = subprocess.run(
        ["ollama", "run", "glm-ocr",
         "이 문서의 모든 텍스트를 읽어줘.",
         safe_path],
        capture_output=True,
        timeout=90,
        env=env
    )

    if safe_path != image_path and os.path.exists(safe_path):
        os.unlink(safe_path)

    stdout = result.stdout.decode('utf-8', errors='replace')
    stdout = clean_text(stdout)

    if result.returncode != 0:
        stderr = result.stderr.decode('utf-8', errors='replace')
        raise RuntimeError(f"code={result.returncode}: {clean_text(stderr)[:100]}")

    if not stdout:
        raise RuntimeError("빈 결과")

    return stdout

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "경로 필요"}, ensure_ascii=False))
        sys.exit(1)

    try:
        text = run_glm_ocr(sys.argv[1])
        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
