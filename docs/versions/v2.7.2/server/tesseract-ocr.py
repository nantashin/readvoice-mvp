import sys
import json
import subprocess
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

def run_tesseract(image_path):
    try:
        tesseract_path = r"C:\Users\tara0\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

        result = subprocess.run(
            [tesseract_path, image_path, "stdout",
             "-l", "kor+eng",
             "--oem", "3",
             "--psm", "6"],
            capture_output=True,
            encoding='utf-8',
            timeout=60
        )

        text = result.stdout.strip()

        print(json.dumps({
            "success": True,
            "text": text,
            "length": len(text)
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "text": ""
        }, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "이미지 경로 필요"}))
        sys.exit(1)
    run_tesseract(sys.argv[1])
