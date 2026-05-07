import sys
import json
from PIL import Image, ImageFilter, ImageEnhance
import os

def enhance_for_ocr(input_path: str, output_path: str) -> dict:
    try:
        img = Image.open(input_path)

        # 1. 흑백 변환
        if img.mode != 'L':
            img = img.convert('L')

        # 2. 해상도 체크 - 300DPI 미만이면 업스케일
        w, h = img.size
        if w < 2000:
            scale = 2000 / w
            img = img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)

        # 3. 선명도 강화
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.SHARPEN)

        # 4. 대비 강화 (인감도장 등 흐린 부분)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)

        # 5. 밝기 조정 (너무 어두운 경우)
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.2)

        # 6. 이진화 (흑백 명확히)
        img = img.point(lambda x: 0 if x < 128 else 255, '1')
        img = img.convert('L')

        img.save(output_path, 'PNG', dpi=(300, 300))

        return {"success": True, "enhanced": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = enhance_for_ocr(sys.argv[1], sys.argv[2])
    print(json.dumps(result, ensure_ascii=False))
