import sys
import json
import os

def get_image_quality(image_path):
    """이미지 화질 점수 계산 (0~100)"""
    try:
        from PIL import Image, ImageFilter

        img = Image.open(image_path).convert('L')  # 그레이스케일
        width, height = img.size

        # 1. 해상도 점수 (300DPI 기준 A4 = 2480x3508)
        pixel_count = width * height
        res_score = min(100, pixel_count / (2480 * 3508) * 100)

        # 2. 선명도 점수 (라플라시안 분산)
        edge = img.filter(ImageFilter.FIND_EDGES)
        pixels = list(edge.getdata())
        if len(pixels) > 0:
            mean = sum(pixels) / len(pixels)
            variance = sum((p - mean) ** 2 for p in pixels) / len(pixels)
            sharp_score = min(100, variance / 50)
        else:
            sharp_score = 0

        total_score = (res_score * 0.4) + (sharp_score * 0.6)
        return {
            "score": round(total_score, 1),
            "width": width,
            "height": height,
            "needs_enhance": total_score < 60
        }
    except Exception as e:
        return {"score": 50, "width": 0, "height": 0, "needs_enhance": True, "error": str(e)}

def enhance_image(image_path, output_path):
    """이미지 선명도 강화"""
    try:
        from PIL import Image, ImageFilter, ImageEnhance

        img = Image.open(image_path)
        width, height = img.size

        # 1. 업스케일 (2x) - LANCZOS 고품질
        if width < 2000 or height < 2000:
            img = img.resize((width * 2, height * 2), Image.LANCZOS)

        # 2. 선명도 강화
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.5)

        # 3. 대비 강화 (텍스트 가독성)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)

        # 4. 엣지 강화 (문자 경계 선명하게)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.filter(ImageFilter.SHARPEN)

        # 5. 그레이스케일 변환 후 이진화 (흑백 문서용)
        gray = img.convert('L')

        # 저장
        gray.save(output_path, 'PNG', optimize=True)

        new_width, new_height = gray.size
        return {
            "success": True,
            "original": f"{width}x{height}",
            "enhanced": f"{new_width}x{new_height}"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "인자 부족: image_path output_path"}))
        sys.exit(1)

    image_path = sys.argv[1]
    output_path = sys.argv[2]

    os.environ['PYTHONIOENCODING'] = 'utf-8'

    # 화질 체크
    quality = get_image_quality(image_path)

    if quality.get("needs_enhance", True):
        # 화질 강화 필요
        result = enhance_image(image_path, output_path)
        result["quality"] = quality
        result["enhanced"] = True
    else:
        # 화질 충분 - 원본 복사
        import shutil
        shutil.copy2(image_path, output_path)
        result = {"success": True, "quality": quality, "enhanced": False}

    print(json.dumps(result, ensure_ascii=False))
