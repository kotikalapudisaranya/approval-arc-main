// Deterministic structured-field extraction from document text: keyword,
// regex and template rules only — never an LLM.
import { DOC_FIELD_LABELS, DOCUMENT_FIELD_PROFILES, normalize } from "@/convex/lib/config";

export type ExtractedField = {
  key: string;
  label: string;
  value?: string;
  source: "extract";
};

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** Parse a flexible date into YYYY-MM-DD or null. */
export function parseFlexibleDate(s: string): string | null {
  if (!s) return null;
  let t = s.trim().replace(/st|nd|rd|th/g, "").replace(/\s+/g, " ");

  // ISO
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // dd mmm yyyy | mmm dd, yyyy | dd/mm/yyyy | dd-mm-yyyy | dd.mm.yyyy
  const monthName = (name: string) => {
    const i = MONTHS.findIndex((x) => name.toLowerCase().startsWith(x));
    return i >= 0 ? i + 1 : 0;
  };
  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [d, mo, yr] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (yr < 100) yr += 2000;
    const dt = new Date(yr, mo - 1, d);
    if (!Number.isNaN(dt.getTime())) return `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (m) {
    const mo = monthName(m[2]);
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = monthName(m[1]);
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  }
  // dd MMM yyyy with trailing text
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mo = monthName(m[2]);
    if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }
  return null;
}

const DATE_LABEL =
  "(?:date\\s*of\\s*issue|issue\\s*date|issued?\\s*on|dated|issued\\s*at|date\\s*of\\s*application|date\\s*of\\s*registration)";
const EXPIRY_LABEL =
  "(?:date\\s*of\\s*expiry|expiry\\s*date|expires?\\s*on|valid\\s*(?:upto|until|till|up to|through)|expiration\\s*date|validity\\s*(?:upto|until))";

const NUMBER_LABEL =
  "(?:certificate\\s*(?:no|number|ref|id)?|registration\\s*(?:no|number|ref|id)?|licence|license|consent\\s*(?:no|number)?|approval\\s*(?:no|number|ref)?|reference\\s*(?:no|number|ref)?|application\\s*(?:no|number)?|document\\s*(?:no|number)?|sanction\\s*(?:no|number)?|permit\\s*(?:no|number)?|udyam\\s*(?:no|number)?|fssai\\s*(?:no|number)?|gstin|pan)\\s*[:.#\\-]?\\s*";

function lineHasLabel(line: string, labelRe: RegExp): boolean {
  return labelRe.test(line);
}

/** Extract structured fields from extracted text + known profile context. */
export function extractStructuredFields(
  text: string,
  opts: { businessName?: string; address?: string; documentType?: string; qrCode?: string },
): ExtractedField[] {
  const out: ExtractedField[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const full = lines.join("\n");
  const add = (key: string, label: string, value?: string) => {
    if (value && value.trim()) {
      // dedupe by key, keep first
      if (!out.some((f) => f.key === key)) out.push({ key, label, value: value.trim(), source: "extract" });
    }
  };

  const cleanOcrValue = (value: string) => value.replace(/[|]+/g, "I").replace(/\s+/g, " ").trim();
  const labeledValue = (patterns: RegExp[]) => {
    const line = lines.find((candidate) => patterns.some((pattern) => pattern.test(candidate)));
    return line ? cleanOcrValue(line.replace(/^[^:\-]+[:\-]\s*/, "")) : undefined;
  };

  if (opts.documentType === "pan") {
    const pan = full.match(/\b[A-Z]{5}\s*[0-9]{4}\s*[A-Z]\b/i)?.[0].replace(/\s+/g, "").toUpperCase();
    const nameLine = lines.find((line) => /^(?:name|holder name|name of holder)\s*[:\-]/i.test(line));
    const qrLine = lines.find((line) => /\bqr(?:\s*code)?\b\s*[:\-]/i.test(line));
    add("businessName", "Name", nameLine ? cleanOcrValue(nameLine.replace(/^[^:\-]+[:\-]\s*/, "")) : opts.businessName);
    add("documentNumber", "PAN Number", pan);
    add("qrCode", "QR Code", opts.qrCode ?? qrLine?.replace(/^[^:\-]+[:\-]\s*/, ""));
  }

  add(
    "businessName",
    "Business Name",
    labeledValue([/^(?:business|company|enterprise|organization)\s+name\s*[:\-]/i, /^(?:applicant|proprietor)\s+name\s*[:\-]/i]),
  );

  // --- document / registration number ---
  for (const l of lines) {
    if (lineHasLabel(l, /(?:certificate|registration|consent|licence|approval|reference|application|document|sanction|permit)\s*(?:no|number|ref|id)?\s*[:.#\-]/i)) {
      const v = l.replace(/^.*?[:.#\-]\s*/, "");
      add("documentNumber", "Document / Certificate Number", cleanOcrValue(v.slice(0, 80)));
    }
  }
  // known serial formats anywhere
  const knownFormats: [RegExp, string][] = [
    [/UDYAM-[A-Z0-9]{2}-[0-9]{2}-[0-9]{6,8}/i, "documentNumber"],
    [/FSSAI-[0-9]{14}/i, "documentNumber"],
    [/[0-9A-Z]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/, "documentNumber"], // GSTIN
    [/[A-Z]{5}[0-9]{4}[A-Z]/, "documentNumber"], // PAN
    [/CTE[\/\s-]*[A-Z0-9./-]{4,}/i, "documentNumber"],
    [/CTO[\/\s-]*[A-Z0-9./-]{4,}/i, "documentNumber"],
  ];
  for (const [re, key] of knownFormats) {
    const mm = full.match(re);
    if (mm) add(key, "Document / Certificate Number", mm[0]);
  }
  for (const l of lines) {
    if (lineHasLabel(l, /registration\s*(?:no|number|ref|id)?\s*[:.#\-]/i)) {
      const v = l.replace(/^.*?[:.#\-]\s*/, "");
      add("registrationNumber", "Registration Number", cleanOcrValue(v.slice(0, 80)));
    }
  }

  // --- business name ---
  const orgName = opts.businessName ? normalize(opts.businessName) : "";
  if (orgName) {
    const tokens = orgName.split(" ").filter((t) => t.length > 3);
    let bestLine: string | null = null;
    let bestScore = 0;
    for (const l of lines) {
      const nl = normalize(l);
      const score = tokens.filter((t) => nl.includes(t)).length;
      if (score > bestScore) {
        bestScore = score;
        bestLine = l;
      }
    }
    if (bestLine && (bestScore >= Math.min(2, tokens.length) || normalize(bestLine).includes(orgName))) {
      add("businessName", "Business Name", stripLabel(bestLine));
    }
  }

  // --- dates ---
  const grabDate = (labelRe: RegExp, isExpiry: boolean) => {
    for (const l of lines) {
      if (lineHasLabel(l, labelRe)) {
        const after = l.replace(labelRe, "").replace(/^[:.#\-]?\s*/, "");
        const d = parseFlexibleDate(after);
        if (d) {
          add(isExpiry ? "expiryDate" : "issueDate", isExpiry ? "Expiry Date" : "Issue Date", d);
          return;
        }
      }
    }
  };
  grabDate(new RegExp(DATE_LABEL, "i"), false);
  grabDate(new RegExp(EXPIRY_LABEL, "i"), true);
  // fall back: "valid upto 11 Aug 2027" type text
  if (!out.some((f) => f.key === "expiryDate")) {
    const m = full.match(new RegExp(EXPIRY_LABEL + "\\s*:?\\s*([^\\n]{4,30})", "i"));
    if (m) {
      const d = parseFlexibleDate(m[1].replace(/[;,.]$/, ""));
      if (d) add("expiryDate", "Expiry Date", d);
    }
  }

  // --- authority ---
  const knownAuthorities = [
    "Maharashtra Pollution Control Board", "MPCB", "FSSAI", "DISH", "Directorate of Industrial Safety",
    "Pune Municipal Corporation", "PMC", "Directorate of Industries", "Fire Services", "MoFPI", "GSDA",
    "Legal Metrology", "Chief Electrical Inspector",
  ];
  const foundAuthority = knownAuthorities.find((a) => full.toLowerCase().includes(a.toLowerCase()));
  if (foundAuthority) add("authority", "Issuing Authority", foundAuthority);

  // --- certificate type: usually near the top, before the business name ---
  const nameIdx = lines.findIndex((l) => normalize(l).includes(orgName));
  const head = (nameIdx > 0 ? lines.slice(0, nameIdx) : lines.slice(0, 3)).filter(
    (l) => !/(^|\s)(page|date|reference|no\.?|ref|www|http)/i.test(l),
  );
  if (head.length > 0) add("certificateType", "Certificate Type", head[0].slice(0, 90));

  const labelPatterns: Record<string, RegExp> = {
    address: /^(?:registered\s+address|address|residential\s+address)\s*[:\-]/i,
    siteAddress: /^(?:site\s+address|premises\s+address|location)\s*[:\-]/i,
    planType: /^(?:plan\s+type|type\s+of\s+plan|drawing\s+type)\s*[:\-]/i,
    preparedBy: /^(?:prepared\s+by|prepared\s+and\s+signed\s+by|engineer)\s*[:\-]/i,
    applicationNumber: /^(?:application\s+(?:no|number|id)|acknowledgement\s+(?:no|number))\s*[:.#\-]/i,
    licenceNumber: /^(?:licen[cs]e\s+(?:no|number)|licen[cs]e\s+id)\s*[:.#\-]/i,
    testDate: /^(?:test\s+date|sample\s+date|date\s+of\s+test)\s*[:\-]/i,
    testResult: /^(?:test\s+result|result|conclusion)\s*[:\-]/i,
    equipmentDetails: /^(?:equipment|equipment\s+details|machinery)\s*[:\-]/i,
    loadDetails: /^(?:connected\s+load|load\s+details|sanctioned\s+load)\s*[:\-]/i,
    wasteType: /^(?:waste\s+type|type\s+of\s+waste)\s*[:\-]/i,
    quantity: /^(?:quantity|daily\s+quantity|capacity)\s*[:\-]/i,
    packagingDetails: /^(?:packaging|packaging\s+details)\s*[:\-]/i,
  };
  const valueAfterLabel = (line: string) => cleanOcrValue(line.replace(/^[^:\-]+[:\-]\s*/, ""));
  for (const [key, pattern] of Object.entries(labelPatterns)) {
    const line = lines.find((candidate) => pattern.test(candidate));
    if (line) add(key, DOC_FIELD_LABELS[key] ?? key, valueAfterLabel(line));
  }

  const profileKeys = DOCUMENT_FIELD_PROFILES[opts.documentType ?? "other"] ?? DOCUMENT_FIELD_PROFILES.other;
  return profileKeys.map((key) => ({
    key,
    label: DOC_FIELD_LABELS[key] ?? key,
    value: out.find((field) => field.key === key)?.value,
    source: "extract" as const,
  }));
}

function stripLabel(line: string): string {
  return line.replace(/^[A-Za-z /&]+:\s*/, "").trim();
}

/** Field form config: which keys the user can correct/confirm. */
export const FIELD_KEYS = [
  "businessName",
  "documentNumber",
  "registrationNumber",
  "certificateType",
  "issueDate",
  "expiryDate",
  "authority",
  "address",
] as const;

export function fieldLabel(key: string, documentType?: string): string {
  if (documentType === "pan") {
    if (key === "businessName") return "Name";
    if (key === "documentNumber") return "PAN Number";
  }
  return DOC_FIELD_LABELS[key] ?? key;
}

export function reviewFieldKeys(documentType?: string): string[] {
  return DOCUMENT_FIELD_PROFILES[documentType ?? "other"] ?? DOCUMENT_FIELD_PROFILES.other;
}