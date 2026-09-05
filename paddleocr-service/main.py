import os
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException
from paddleocr import PaddleOCR
from pydantic import BaseModel, HttpUrl


class OcrRequest(BaseModel):
    image_url: HttpUrl
    document_type: str


app = FastAPI(title="ApprovalArc PaddleOCR 3 service")
ocr = PaddleOCR(
    lang=os.getenv("PADDLEOCR_LANG", "en"),
    use_doc_orientation_classify=True,
    use_doc_unwarping=True,
    use_textline_orientation=True,
)


def result_text(result: Any) -> str:
    payload = getattr(result, "json", result)
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        return payload
    if isinstance(payload, dict):
        texts = payload.get("rec_texts") or payload.get("text") or []
        if isinstance(texts, str):
            return texts.strip()
        if isinstance(texts, list):
            return "\n".join(str(value).strip() for value in texts if str(value).strip())
    return ""


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "paddleocr3"}


@app.post("/ocr")
async def recognize(payload: OcrRequest, authorization: str | None = Header(default=None)) -> dict[str, str]:
    expected_key = os.getenv("PADDLEOCR_API_KEY")
    if expected_key and authorization != f"Bearer {expected_key}":
        raise HTTPException(status_code=401, detail="Invalid OCR service credentials.")

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(str(payload.image_url))
        response.raise_for_status()

    result = ocr.predict(input=response.content)
    text = "\n".join(result_text(item) for item in result).strip()
    return {"text": text}