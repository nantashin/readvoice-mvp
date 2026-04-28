import sys, json, subprocess, re

TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def run_tesseract(image_path: str) -> str:
    result = subprocess.run(
        [TESSERACT, image_path, "stdout", "-l", "kor+eng", "--psm", "6"],
        capture_output=True, timeout=60
    )
    text = result.stdout.decode("utf-8", errors="replace")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return "\n".join(lines)

if __name__ == "__main__":
    try:
        text = run_tesseract(sys.argv[1])
        print(json.dumps({"success": True, "text": text}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
