import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Backend OCR fallback. The PaddleOCR 3 service receives a temporary Convex
 * storage URL and returns { text }. Keep the provider behind this action so
 * the browser never needs Paddle credentials or network access to the OCR API.
 */
export const runPaddleOcr = action({
  args: {
    storageId: v.string(),
    documentType: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Authentication required.");
    const endpoint = process.env.PADDLEOCR_URL;
    if (!endpoint) return { text: "", configured: false };
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) return { text: "", configured: true };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
        ...(process.env.PADDLEOCR_API_KEY ? { Authorization: `Bearer ${process.env.PADDLEOCR_API_KEY}` } : {}),
      },
      body: JSON.stringify({ image_url: fileUrl, document_type: args.documentType }),
    });
    if (!response.ok) throw new Error(`PaddleOCR service returned ${response.status}.`);
    const result = (await response.json()) as { text?: string };
    return { text: result.text?.trim() ?? "", configured: true };
  },
});