import sys
import subprocess
import json
import re
import os
import shutil

# Windows UTF-8 강제
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

MAX_IMAGE_SIDE = 2048

def emit_json(success: bool, text: str = "", error: str = ""):
    """표준 JSON 출력"""
    result = {"success": success}
    if text:
        result["text"] = text
    if error:
        result["error"] = error
    print(json.dumps(result, ensure_ascii=False))

def clean_text(text: str) -> str:
    """ANSI 코드 및 노이즈 제거"""
    ansi = re.compile(r'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\[K')
    text = ansi.sub('', text)
    text = re.sub(r'[\u2800-\u28FF]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def resolve_ollama_bin() -> str:
    """ollama 실행 파일 경로 탐색"""
    # PATH에서 ollama 찾기
    ollama = shutil.which("ollama")
    if ollama:
        return ollama

    # Windows 기본 경로 시도
    if sys.platform == "win32":
        default_path = r"C:\Users\tara0\AppData\Local\Programs\Ollama\ollama.exe"
        if os.path.exists(default_path):
            return default_path

    raise FileNotFoundError("ollama 실행 파일을 찾을 수 없습니다")

def prepare_image(image_path: str) -> str:
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        w, h = img.size

        # GLM-OCR은 448의 배수 필요
        target = 448
        new_w = max(target, (w // target) * target)
        new_h = max(target, (h // target) * target)

        # 너무 크면 축소
        if new_w > 1792:
            new_w = 1792
        if new_h > 1792:
            new_h = 1792

        img_resized = img.resize((new_w, new_h), Image.LANCZOS)

        out_path = image_path.replace(".png", "_prep.png")
        img_resized.save(out_path, "PNG")
        print(f"[준비] {w}x{h} → {new_w}x{new_h}", file=sys.stderr)
        return out_path
    except Exception as e:
        print(f"[준비 실패] {e}", file=sys.stderr)
        return image_path

def run_glm_ocr(image_path: str) -> str:
    """GLM-OCR 실행"""
    prepared_path = prepare_image(image_path)

    try:
        ollama_bin = resolve_ollama_bin()
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'

        # Ollama PATH 명시적 추가 (Node.js subprocess 환경 보장)
        if sys.platform == "win32":
            ollama_dir = r"C:\Users\tara0\AppData\Local\Programs\Ollama"
            if "PATH" in env:
                env["PATH"] = f"{ollama_dir};{env['PATH']}"
            else:
                env["PATH"] = ollama_dir

        result = subprocess.run(
            [ollama_bin, "run", "glm-ocr",
             "이 문서의 모든 텍스트를 읽어줘.",
             prepared_path],
            capture_output=True,
            timeout=90,
            env=env
        )

        # 준비된 임시 파일 삭제
        if prepared_path != image_path and os.path.exists(prepared_path):
            os.unlink(prepared_path)

        stdout = result.stdout.decode('utf-8', errors='replace')
        stdout = clean_text(stdout)

        if result.returncode != 0:
            stderr = result.stderr.decode('utf-8', errors='replace')
            raise RuntimeError(f"ollama 실행 실패 (code={result.returncode}): {clean_text(stderr)[:100]}")

        if not stdout:
            raise RuntimeError("빈 결과")

        return stdout

    except Exception as e:
        # 에러 시에도 임시 파일 정리
        if prepared_path != image_path and os.path.exists(prepared_path):
            try:
                os.unlink(prepared_path)
            except:
                pass
        raise

if __name__ == "__main__":
    if len(sys.argv) < 2:
        emit_json(False, error="이미지 경로가 필요합니다")
        sys.exit(1)

    try:
        text = run_glm_ocr(sys.argv[1])
        emit_json(True, text=text)
    except Exception as e:
        emit_json(False, error=str(e))
