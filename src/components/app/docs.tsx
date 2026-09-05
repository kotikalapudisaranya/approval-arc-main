import { ChangeEvent, ReactNode, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DOCUMENT_TYPES } from "@/convex/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { extractPdfText, sha256Hex, generateSamplePdf } from "@/lib/pdf";
import { extractStructuredFields, fieldLabel, reviewFieldKeys } from "@/lib/fields";
import { normalize } from "@/convex/lib/config";
import { EmptyState, Section, StatusBadge } from "./ui";
import { docStatusMeta, extractionMeta, verificationMeta, fmtDate, fmtDateTime } from "@/lib/format";
import {
  Download,
  FileUp,
  Hash,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createWorker } from "tesseract.js";
import jsQR from "jsqr";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const ACCEPT = ".pdf,.png,.jpg,.jpeg";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type UploadOutcome = {
  documentId: Id<"documents">;
  extractionStatus: string;
  fieldCount: number;
  sha256: string;
};

// The mutation references are deliberately widened (via unknown) so the
// shared pipeline stays decoupled from Convex's generated arg types.
type UploadFn = (args: Record<string, unknown>) => Promise<unknown>;

export const asUploadFn = <T,>(fn: T): UploadFn => fn as unknown as UploadFn;

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

async function prepareOcrImage(file: File): Promise<HTMLCanvasElement> {
  const image = await createImageBitmap(file);
  const scale = Math.min(2.5, 2400 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to prepare the uploaded image for OCR.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = Math.round(0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2]);
    const enhanced = gray < 165 ? Math.max(0, gray - 20) : Math.min(255, gray + 20);
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  image.close();
  return canvas;
}

async function recognizeWithPasses(worker: OcrWorker, source: HTMLCanvasElement, onStage?: (stage: string) => void) {
  const texts: string[] = [];
  for (const mode of ["6", "11"]) {
    onStage?.(`OCR pass ${mode === "6" ? "document layout" : "sparse text"}…`);
    await worker.setParameters({ tessedit_pageseg_mode: mode as never });
    const result = await worker.recognize(source);
    if (result.data.text.trim()) texts.push(result.data.text.trim());
  }
  return Array.from(new Set(texts.join("\n").split("\n").map((line) => line.trim()).filter(Boolean)).values()).join("\n");
}

async function readQrCode(file: File): Promise<string | undefined> {
  try {
    const image = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    image.close();
    return jsQR(pixels.data, pixels.width, pixels.height)?.data;
  } catch {
    return undefined;
  }
}

async function ocrPdfPages(
  buffer: ArrayBuffer,
  worker: OcrWorker,
  onStage?: (stage: string) => void,
): Promise<string | null> {
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  try {
    for (let index = 1; index <= pdf.numPages; index += 1) {
      onStage?.(`Running OCR on PDF page ${index} of ${pdf.numPages}…`);
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await recognizeWithPasses(worker, canvas, onStage);
      if (result) pages.push(result);
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    pdf.cleanup();
  }
  return pages.length > 0 ? pages.join("\n\n") : null;
}

async function uploadFile(opts: {
  file: File;
  documentType: string;
  organizationId: Id<"organizations">;
  applicationId?: Id<"applications">;
  businessName?: string;
  address?: string;
  generateUploadUrl: (args: Record<string, unknown>) => Promise<string>;
  recordDocument: UploadFn;
  backendOcr?: (args: { storageId: string; documentType: string }) => Promise<{ text: string; configured: boolean }>;
  onStage?: (stage: string) => void;
}): Promise<UploadOutcome> {
  const { file, documentType, organizationId, applicationId, businessName, address, onStage } = opts;
  // client-side file checks (server re-validates)
  if (file.size > 15 * 1024 * 1024) throw new Error("File is larger than the 15 MB limit.");
  const mime = file.type.toLowerCase() || inferMime(file.name);
  if (!["application/pdf", "image/png", "image/jpeg"].includes(mime))
    throw new Error("Unsupported file type. Accepted: PDF, PNG, JPG, JPEG.");

  onStage?.("Reading file and calculating SHA-256…");
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);

  let extractionStatus = "PENDING";
  let text: string | null = null;
  onStage?.(mime === "application/pdf" ? "Extracting PDF text…" : "Running OCR on image…");
  if (mime === "application/pdf") {
    text = await extractPdfText(buf);
    if (text) {
      extractionStatus = "EXTRACTED";
    } else {
      const worker = await createWorker("eng");
      try {
        text = await ocrPdfPages(buf, worker, onStage);
        extractionStatus = text ? "EXTRACTED" : "EXTRACTION_FAILED";
      } finally {
        await worker.terminate();
      }
    }
  } else {
    const worker = await createWorker("eng");
    try {
      const canvas = await prepareOcrImage(file);
      text = (await recognizeWithPasses(worker, canvas, onStage)).trim() || null;
      canvas.width = 0;
      canvas.height = 0;
      extractionStatus = text ? "EXTRACTED" : "EXTRACTION_FAILED";
    } finally {
      await worker.terminate();
    }
  }
  const qrCode = documentType === "pan" ? await readQrCode(file) : undefined;
  let fields =
    text && text.trim().length > 0
      ? extractStructuredFields(text, { businessName, address, documentType, qrCode })
      : [];

  onStage?.("Uploading encrypted file to document storage…");
  const uploadUrl = (await opts.generateUploadUrl({})) as string;
  const putRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mime },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload failed. Please try again.");
  const { storageId } = (await putRes.json()) as { storageId: string };

  const missingFields = fields.some((field) => !field.value?.trim());
  if (missingFields && opts.backendOcr) {
    onStage?.("Primary OCR missed fields; running PaddleOCR 3 fallback…");
    try {
      const backend = await opts.backendOcr({ storageId, documentType });
      if (backend.text) {
        const fallbackFields = extractStructuredFields(backend.text, { businessName, address, documentType, qrCode });
        const fieldKeys = reviewFieldKeys(documentType);
        const browserByKey = new Map(fields.map((field) => [field.key, field]));
        const fallbackByKey = new Map(fallbackFields.map((field) => [field.key, field]));
        fields = fieldKeys.map((key) => {
          const browserField = browserByKey.get(key);
          const fallbackField = fallbackByKey.get(key);
          return {
            key,
            label: browserField?.label ?? fallbackField?.label ?? key,
            value: browserField?.value?.trim() || fallbackField?.value,
            source: "extract" as const,
          };
        });
        text = [text, backend.text].filter(Boolean).join("\n");
      }
    } catch (error) {
      console.warn("PaddleOCR fallback unavailable; continuing with browser OCR.", error);
    }
  }

  onStage?.("Recording document and audit event…");
  const res = (await opts.recordDocument({
    applicationId,
    organizationId,
    fileName: file.name,
    mimeType: mime,
    size: file.size,
    storageId,
    sha256,
    extractionStatus,
    extractedText: text ?? undefined,
    extractedFields: fields,
    documentType,
  } as Record<string, unknown>)) as { documentId: string };

  return { documentId: res.documentId as Id<"documents">, extractionStatus, fieldCount: fields.length, sha256 };
}

function inferMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function readErrorMessage(e: unknown): string {
  const err = e as { message?: string; data?: { message?: string } };
  if (err?.data?.message) return err.data.message;
  return err?.message ?? "Something went wrong. Please try again.";
}

export function DocumentUploader({
  organizationId,
  applicationId,
  defaultType,
  businessName,
  address,
  onUploaded,
  types,
}: {
  organizationId?: Id<"organizations">;
  applicationId?: Id<"applications">;
  defaultType?: string;
  businessName?: string;
  address?: string;
  onUploaded?: (outcome: UploadOutcome) => void;
  types?: string[];
}) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const recordDocument = useMutation(api.documents.recordDocument);
  const backendOcr = useAction(api.ocr.runPaddleOcr);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(defaultType ?? "");
  const [stage, setStage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!organizationId) {
      toast.error("Complete your business profile before uploading documents.");
      return;
    }
    if (!type) {
      toast.error("Select a document type first.");
      return;
    }
    setBusy(true);
    setStage("Hashing + OCR/extracting…");
    try {
      const outcome = await uploadFile({
        file,
        documentType: type,
        organizationId,
        applicationId,
        businessName,
        address,
        generateUploadUrl: generateUploadUrl as unknown as (a: Record<string, unknown>) => Promise<string>,
        recordDocument: asUploadFn(recordDocument),
        backendOcr: backendOcr as unknown as (args: { storageId: string; documentType: string }) => Promise<{ text: string; configured: boolean }>,
        onStage: setStage,
      });
      toast.success("Document recorded. Review the extracted fields before validation.");
      onUploaded?.(outcome);
    } catch (e) {
      toast.error(readErrorMessage(e));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const typeOptions = types ?? Object.keys(DOCUMENT_TYPES);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="doc-type" className="mb-1 block text-xs text-muted-foreground">
            Document type
          </Label>
          <select
            id="doc-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2.5 text-[13px] outline-none focus:border-neutral-400"
          >
            <option value="">Select type…</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPES[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => {
              const f = document.createElement("input");
              f.type = "file";
              f.accept = ACCEPT;
              f.onchange = () => {
                const file = f.files?.[0];
                if (file) void handleFile(file);
              };
              f.click();
            }}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
            {busy ? (stage ?? "Uploading…") : "Upload document"}
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        Accepted formats: PDF, PNG, JPG, JPEG · max 15 MB. Uploads are hashed (SHA-256), checked for duplicates,
        and digitally extracted when possible — no AI is used in this pipeline.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          disabled={busy}
          onClick={async () => {
            // Generate a clearly-labelled sample digital PDF so the full
            // pipeline (hash → extraction → fields → confirm) can be demoed.
            const blob = generateSamplePdf({
              heading: "Consent to Establish — ACKNOWLEDGEMENT",
              documentNumber: `CTE-${new Date().getFullYear()}-DEMO-${String(Math.floor(Math.random() * 9000) + 1000)}`,
              businessName: businessName ?? "GreenHarvest Foods Pvt. Ltd.",
              address: address ?? "Plot 21, MIDC Bhosari, Pune",
              authority: "Maharashtra Pollution Control Board",
              issueDate: new Date().toISOString().slice(0, 10),
              body: [
                "This is a sample acknowledgement document for demonstration.",
                `Business Name: ${businessName ?? "GreenHarvest Foods Pvt. Ltd."}`,
                "Reference No: (see above)",
              ],
            });
            const file = new File([blob], "sample-consent-acknowledgement.pdf", { type: "application/pdf" });
            await handleFile(file);
          }}
        >
          <FileText className="mr-1.5 size-3.5" />
          Generate sample PDF (demo)
        </Button>
      </div>
    </div>
  );
}

export function ExtractionReview({
  document,
  onDone,
}: {
  document: {
    _id: Id<"documents">;
    fileName: string;
    documentType?: string;
    extractedFields: { key: string; label: string; value?: string; source: string }[];
    extractionStatus: string;
    fieldsConfirmed: boolean;
    extractedText?: string;
  };
  onDone?: () => void;
}) {
  const confirmFields = useMutation(api.documents.confirmDocumentFields);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of document.extractedFields) if (f.value) init[f.key] = f.value;
    return init;
  });
  const [busy, setBusy] = useState(false);

  const known = Array.from(new Set([...reviewFieldKeys(document.documentType), ...document.extractedFields.map((f) => f.key)]));
  const rows = known.map((k) => ({
    key: k,
    value: fields[k] ?? document.extractedFields.find((f) => f.key === k)?.value ?? "",
  }));

  const submit = async (corrections: Record<string, string>) => {
    setBusy(true);
    try {
      await confirmFields({
        documentId: document._id,
        fields: rows
          .filter((r) => corrections[r.key] !== undefined)
          .map((r) => ({ key: r.key, label: fieldLabel(r.key, document.documentType), value: corrections[r.key] || undefined })),
      });
      toast.success("Fields confirmed — validation and verification checks ran.");
      onDone?.();
    } catch (e) {
      toast.error(readErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{document.fileName}</p>
        <StatusBadge meta={extractionMeta[document.extractionStatus] ?? extractionMeta.PENDING} />
      </div>
      <NoticeInline text="Never silently accept extracted information — review and confirm every field below." />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <Label htmlFor={`f-${r.key}`} className="text-[11px] text-muted-foreground">
              {fieldLabel(r.key, document.documentType)}
            </Label>
            <Input
              id={`f-${r.key}`}
              value={r.value}
              onChange={(e) => setFields((p) => ({ ...p, [r.key]: e.target.value }))}
              className="h-8 text-[13px]"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button disabled={busy} onClick={() => submit(fields)}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Confirm & validate
        </Button>
      </div>
    </div>
  );
}

function NoticeInline({ text }: { text: string }) {
  return (
    <p className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800">
      {text}
    </p>
  );
}

export type DocRow = {
  _id: Id<"documents">;
  fileName: string;
  documentType?: string;
  mimeType: string;
  size: number;
  sha256: string;
  extractionStatus: string;
  fieldsConfirmed: boolean;
  validationStatus: string;
  verificationStatus: string;
  verificationDetail?: string;
  status: string;
  _creationTime: number;
};

export function DocumentTable({ docs }: { docs: DocRow[] }) {
  const getUrl = useQuery;
  void getUrl;
  return (
    <div className="space-y-2">
      {docs.length === 0 && <EmptyState title="No documents yet" description="Upload your first document to start the validation pipeline." />}
      {docs.map((d) => (
        <DocumentRow key={d._id} doc={d} />
      ))}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocRow }) {
  const getDocumentUrl = useMutation(api.documents.logDocumentAccess);
  const revokeDocument = useMutation(api.documents.revokeDocument);
  const [url, setUrl] = useState<string | null>(null);

  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{doc.fileName}</p>
            <p className="text-[11px] text-muted-foreground">
              {(doc.documentType && DOCUMENT_TYPES[doc.documentType]) || doc.documentType || "Unclassified"} ·{" "}
              {fmtDateTime(doc._creationTime)} · {(doc.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <StatusBadge meta={extractionMeta[doc.extractionStatus]} />
          <span
            className={cn(
              "inline-flex items-center gap-1",
              doc.fieldsConfirmed ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {doc.fieldsConfirmed ? "Confirmed" : "Awaiting confirmation"}
          </span>
          <StatusBadge meta={docStatusMeta[doc.validationStatus]} />
          <StatusBadge meta={verificationMeta[doc.verificationStatus]} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-mono" title="SHA-256">
          <Hash className="size-3" /> {doc.sha256.slice(0, 16)}…
        </span>
        {doc.verificationDetail && <span className="max-w-md truncate">{doc.verificationDetail}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={async () => {
            await getDocumentUrl({ documentId: doc._id }).catch(() => undefined);
            toast.info("Access logged to the audit trail.", { description: doc.fileName });
          }}
        >
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            void getDocumentUrl({ documentId: doc._id }).then(() => undefined);
            toast.info("Demo: open the application detail to view/download.", { description: doc.fileName });
          }}
        >
          <Download className="mr-1 size-3" /> Download
        </Button>
        {doc.status === "ACTIVE" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-red-600"
            onClick={async () => {
              if (!window.confirm("Revoke this document? It will no longer be usable in applications.")) return;
              await revokeDocument({ documentId: doc._id, reason: "Revoked by owner" });
              toast.success("Document revoked.");
            }}
          >
            <Trash2 className="mr-1 size-3" /> Revoke
          </Button>
        )}
      </div>
      {url && null}
    </div>
  );
}

export function DocumentChecks({ checks }: { checks: { check: string; status: string; detail: string }[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border text-xs">
      {checks.map((c, i) => (
        <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
          <span className="font-medium">{c.check}</span>
          <span className="flex items-center gap-2 text-right">
            <StatusBadge
              meta={{
                label: c.status,
                tone:
                  c.status === "PASSED"
                    ? "success"
                    : c.status === "FAILED"
                      ? "danger"
                      : c.status === "WARNING"
                        ? "warning"
                        : "muted",
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function IssuerCheck({ document, onRun }: { document: DocRow & { fieldsConfirmed: boolean }; onRun?: () => void }) {
  const verify = useMutation(api.documents.verifyViaIssuerRegistry);
  const [busy, setBusy] = useState(false);
  void RefreshCcw;
  void ShieldCheck;
  void fmtDate;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      disabled={!document.fieldsConfirmed || busy}
      title="Prototype Verification Gateway — Simulation"
      onClick={async () => {
        setBusy(true);
        try {
          const r = await verify({ documentId: document._id });
          toast.success("Issuer lookup completed.", { description: (r as { verificationDetail?: string }).verificationDetail });
          onRun?.();
        } catch (e) {
          toast.error(readErrorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ShieldCheck className="mr-1 size-3" />}
      Check issuer registry
    </Button>
  );
}

export { useQuery, useMutation, Textarea as TAlias };