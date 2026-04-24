import sys
import pypdfium2 as pdfium
import base64
import json

def pdf_to_image(pdf_path, page_num=0, dpi=200):
    pdf = pdfium.PdfDocument(pdf_path)
    page = pdf[page_num]
    scale = dpi / 72
    bitmap = page.render(scale=scale, rotation=0)
    pil_image = bitmap.to_pil()

    import io
    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    buf.seek(0)

    b64 = base64.b64encode(buf.read()).decode("utf-8")
    total_pages = len(pdf)

    print(json.dumps({
        "success": True,
        "base64": b64,
        "total_pages": total_pages
    }))

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    pdf_to_image(pdf_path, page_num)
