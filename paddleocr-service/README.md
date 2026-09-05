# PaddleOCR 3 fallback service

Run this service separately from the Vite and Convex processes:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Configure the Convex deployment environment with:

```bash
npx convex env set PADDLEOCR_URL http://your-host:8000/ocr
npx convex env set PADDLEOCR_API_KEY your-shared-secret
```

The endpoint accepts `{ "image_url": "...", "document_type": "pan" }` and returns `{ "text": "..." }`.