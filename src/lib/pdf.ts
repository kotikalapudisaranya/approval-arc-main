// Deterministic PDF utilities. NO AI/OCR: text extraction handles digital
// PDFs by decompressing content streams (zlib) and decoding text operators
// (Tj / TJ). Scanned PDFs and images simply report that no OCR engine is
// configured — an honest, human-reviewable state.

export function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer).then((h) => {
    return Array.from(new Uint8Array(h))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

async function inflate(data: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function decodePdfString(raw: string): string {
  return raw
    .replace(/\\([nrtbf()\\])/g, (_m, c: string) => {
      switch (c) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        default:
          return c;
      }
    })
    .replace(/\\(\d{1,3})/g, (_m, o: string) => String.fromCharCode(parseInt(o, 8)));
}

function extractContentText(content: string): string {
  const lines: string[] = [];
  // Only look inside text objects.
  const btBlocks = content.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of btBlocks) {
    let line = "";
    const push = () => {
      if (line.trim().length > 0) {
        lines.push(line.trim());
        line = "";
      }
    };
    // Simple tokenization across operators we support.
    const ops = block.match(/\[[\s\S]*?\]\s*TJ|\([\s\S]*?\)\s*Tj|\bT\*|\b[Tt][Dd]\b|\bTD\b/g) ?? [];
    for (const op of ops) {
      if (op.includes("TJ") && op.startsWith("[")) {
        const parts = op.slice(1, op.indexOf("]")).match(/\(((?:[^()\\]|\\.)*)\)/g) ?? [];
        for (const p of parts) line += decodePdfString(p.slice(1, -1));
      } else if (op.trimEnd().endsWith("Tj")) {
        const m = op.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/);
        if (m) line += decodePdfString(m[1]);
      } else if (op.trim() === "T*" || /Td|TD/.test(op)) {
        push();
      }
    }
    push();
  }
  return lines.join("\n");
}

/**
 * Extract text from a digital PDF by decoding its content streams.
 * Returns null when the PDF is not extractable (scanned/encrypted/unsupported).
 */
export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string | null> {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(bytes);
    if (!raw.startsWith("%PDF")) return null;

    const streams = raw.match(/stream\r?\n([\s\S]*?)endstream/g) ?? [];
    const candidates: string[] = [];
    for (const s of streams) {
      const body = s.replace(/^stream\r?\n/, "").replace(/endstream$/, "");
      if (body.length === 0) continue;
      // If the stream dictionary contained /FlateDecode it will typically
      // start with the zlib header 0x78. Try both wrapper forms anyway.
      let decoded: Uint8Array | null = null;
      for (const fmt of ["deflate", "deflate-raw"] as const) {
        try {
          decoded = await inflate(bodyToBytes(body), fmt);
          break;
        } catch {
          // try next
        }
      }
      if (!decoded) continue;
      const text = extractContentText(new TextDecoder("latin1").decode(decoded));
      if (text) candidates.push(text);
    }
    const joined = candidates.join("\n").trim();
    return joined.length > 0 ? joined : null;
  } catch {
    return null;
  }
}

function bodyToBytes(body: string): Uint8Array {
  // Re-encode latin1 to bytes.
  const out = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) out[i] = body.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// Sample PDF generator (demo aid). Creates a simple, text-based digital PDF —
// the kind our extractor can read — so a reviewer can exercise the full
// document pipeline without hunting for a file. Clearly marked "SAMPLE".
// ---------------------------------------------------------------------------

export type SampleDocInput = {
  heading: string;
  documentNumber: string;
  businessName: string;
  address: string;
  authority: string;
  issueDate: string; // e.g. 2026-03-12
  expiryDate?: string;
  body: string[];
};

function escPdf(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function generateSamplePdf(input: SampleDocInput): Blob {
  const rendered: { text: string; size: number; y: number }[] = [];
  let y = 792;
  const put = (text: string, size: number, gap: number) => {
    rendered.push({ text, size, y });
    y -= gap;
  };

  put(input.heading, 14, 30);
  put(`Reference No: ${input.documentNumber}`, 10, 20);
  y -= 4;
  put(input.businessName, 12, 18);
  if (input.address) put(input.address, 10, 18);
  y -= 6;
  for (const l of input.body) put(l, 10, 15);
  y -= 4;
  put(`Issue Date: ${input.issueDate}`, 10, 16);
  if (input.expiryDate) put(`Valid Until: ${input.expiryDate}`, 10, 16);
  put(`Issuing Authority: ${input.authority}`, 10, 16);
  y -= 10;
  put("SAMPLE DOCUMENT — GENERATED FOR DEMONSTRATION, NOT AN OFFICIAL CERTIFICATE.", 8, 12);

  const streamLines = rendered
    .map((l) => `BT /F1 ${l.size} Tf 56 ${l.y} Td (${escPdf(l.text)}) Tj ET`)
    .join("\n");

  const offsets: number[] = [];
  let pdf = "%PDF-1.4\n";
  const add = (obj: string) => {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  };

  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  add("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj");
  add("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  add(`5 0 obj\n<< /Length ${streamLines.length} >>\nstream\n${streamLines}\nendstream\nendobj`);

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}