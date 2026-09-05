// Document Vault: upload pipeline, deterministic validation, prototype issuer
// verification, duplicate detection, version history, revoke, access control.
//
// Pipeline: upload → file integrity → SHA-256 → duplicate detection → text
// extraction → field extraction → human confirmation → validation →
// authenticity verification → final status. No AI anywhere in this pipeline.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import {
  ApprovalError,
  notify,
  recordAudit,
  requireRole,
  requireUser,
} from "./lib/authz";
import { DOCUMENT_FIELD_PROFILES, DOCUMENT_TYPE_MARKERS, DOCUMENT_TYPES, normalize } from "./lib/config";
import { ROLES } from "./schema";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const SHA256_RE = /^[a-f0-9]{64}$/;

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

async function canSeeApplicationDocs(ctx: QueryCtx | MutationCtx, applicationId: Id<"applications"> | null, orgId: Id<"organizations">) {
  const user = await requireUser(ctx);
  if (user.role === ROLES.APPLICANT) {
    return user.organizationId === orgId;
  }
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.DEPT_SUPERVISOR) return true;
  // officer: must belong to the application's department compartment
  if (applicationId) {
    const app = await ctx.db.get(applicationId);
    if (app && user.department && app.department !== user.department) {
      throw new ApprovalError("This document belongs to another department compartment.", "FORBIDDEN");
    }
  }
  return true;
}

function docFieldMaps(doc: Doc<"documents">) {
  const map: Record<string, string | undefined> = {};
  for (const f of doc.extractedFields) map[f.key] = f.value;
  return map;
}

function parseDate(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function looksLikeAadhaar(fields: Record<string, string | undefined>, text?: string) {
  const source = `${text ?? ""} ${Object.values(fields).filter(Boolean).join(" ")}`;
  return /\b(?:aadhaar|aadhar|uidai|unique\s+identification)\b/i.test(source) ||
    /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(source);
}

function hasDocumentTypeMismatch(documentType: string | undefined, text: string | undefined, fields: Record<string, string | undefined>) {
  if (!documentType || documentType === "other") return false;
  const markers = DOCUMENT_TYPE_MARKERS[documentType];
  if (!markers) return false;
  const source = normalize(`${text ?? ""} ${Object.values(fields).filter(Boolean).join(" ")}`);
  return !markers.some((marker) => source.includes(normalize(marker)));
}

async function runValidation(
  ctx: MutationCtx,
  docId: Id<"documents">,
): Promise<{ validationStatus: Doc<"documents">["validationStatus"]; verificationStatus: Doc<"documents">["verificationStatus"]; checks: Doc<"documents">["validationChecks"] }> {
  const doc = await ctx.db.get(docId);
  if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
  const org = await ctx.db.get(doc.organizationId);
  const fields = docFieldMaps(doc);
  const documentNumber = fields.documentNumber ?? fields.licenceNumber ?? fields.applicationNumber;
  const businessName = fields.businessName;
  const issueDateStr = fields.issueDate;
  const expiryDateStr = fields.expiryDate;
  const issueDate = parseDate(issueDateStr);
  const expiryDate = parseDate(expiryDateStr);

  const checks: Doc<"documents">["validationChecks"] = [];
  const aadhaarLike = looksLikeAadhaar(fields, doc.extractedText);
  const documentTypeMismatch = hasDocumentTypeMismatch(doc.documentType, doc.extractedText, fields);

  // 1. Completeness
  const profile = DOCUMENT_FIELD_PROFILES[doc.documentType ?? "other"] ?? DOCUMENT_FIELD_PROFILES.other;
  const identifierKey = profile.includes("documentNumber")
    ? "documentNumber"
    : profile.includes("licenceNumber")
      ? "licenceNumber"
      : profile.includes("applicationNumber")
        ? "applicationNumber"
        : null;
  const requiredFields = [
    ...(profile.includes("businessName") ? ["businessName"] : []),
    ...(identifierKey ? [identifierKey] : []),
    ...(profile.includes("issueDate") ? ["issueDate"] : []),
  ];
  const missing = requiredFields.filter((k) => !fields[k]?.trim());
  checks.push({
    check: "Completeness",
    status: missing.length === 0 ? "PASSED" : "FAILED",
    detail:
      missing.length === 0
        ? "All required fields for this document type are present."
        : `Missing fields: ${missing.join(", ")}.`,
  });

  // 2. Format
  const numOk = documentNumber
    ? doc.documentType === "pan"
      ? /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(documentNumber.trim())
      : /^[A-Z0-9][A-Z0-9/._-]*$/i.test(documentNumber.trim())
    : false;
  const dateOk = doc.documentType === "pan" || issueDate !== null;
  const formatOk = (!identifierKey || numOk) && dateOk;
  checks.push({
    check: "Format",
    status: formatOk ? "PASSED" : "FAILED",
    detail:
      !numOk && !dateOk
        ? "Identifier or date format could not be validated."
        : !dateOk
          ? "Issue date could not be parsed as a date."
          : "Identifier and dates conform to configured formats.",
  });

  // 2b. Content/type compatibility. OCR content must agree with the type
  // selected by the user; a personal identity document is not a business
  // registration, licence, consent, or certificate.
  const identityMismatch = aadhaarLike && doc.documentType !== "address_proof";
  checks.push({
    check: "Document Type and Content",
    status: identityMismatch || documentTypeMismatch ? "FAILED" : aadhaarLike ? "WARNING" : "PASSED",
    detail: identityMismatch
      ? "OCR detected Aadhaar/UIDAI identity-document content, but the selected document type is not Address Proof."
      : documentTypeMismatch
        ? `The uploaded content does not match the selected document type (${doc.documentType}). The document will be revoked.`
      : aadhaarLike
        ? "Aadhaar/UIDAI content detected. Use only as address proof and confirm it belongs to the business premises."
        : "The extracted content does not conflict with the selected document type.",
  });

  // 3. Expiry
  if (expiryDate !== null) {
    const valid = expiryDate >= Date.now();
    checks.push({
      check: "Expiry",
      status: valid ? "PASSED" : "FAILED",
      detail: valid
        ? `Valid until ${new Date(expiryDate).toLocaleDateString()}.`
        : `Expired on ${new Date(expiryDate).toLocaleDateString()}.`,
    });
  } else {
    checks.push({
      check: "Expiry",
      status: "N/A",
      detail: "No expiry date extracted; treated as a non-expiring document.",
    });
  }

  // 4. Business profile matching
  const nameOk = businessName ? normalize(businessName) === normalize(org?.name ?? "") : false;
  checks.push({
    check: "Business Profile Match",
    status: nameOk ? "PASSED" : "FAILED",
    detail:
      businessName && !nameOk
        ? `Extracted business name "${businessName}" does not match the profile ("${org?.name}").`
        : businessName
          ? "Extracted business name matches the business profile."
          : "No business name was extracted. This document cannot establish the business identity.",
  });

  // 5. Cross-document consistency
  const siblings = await ctx.db
    .query("documents")
    .withIndex("by_organization", (q) => q.eq("organizationId", doc.organizationId))
    .collect();
  const confirmed = siblings.filter(
    (d) => d.status === "ACTIVE" && d.fieldsConfirmed && d._id !== docId && d.validationStatus !== "FAILED",
  );
  const mismatches = confirmed.filter((d) => {
    const otherName = d.extractedFields.find((f) => f.key === "businessName")?.value;
    return otherName && businessName && normalize(otherName) !== normalize(businessName);
  });
  checks.push({
    check: "Cross-document Consistency",
    status: mismatches.length > 0 ? "FAILED" : confirmed.length === 0 ? "N/A" : "PASSED",
    detail:
      mismatches.length === 0 && confirmed.length > 0
        ? `${confirmed.length} confirmed document(s) agree on common fields.`
        : mismatches.length > 0
          ? `${mismatches.length} document(s) disagree on the business name.`
          : "No sibling business document is available yet; consistency will be checked when another document is confirmed.",
  });

  // 6. Duplicate detection
  const dupByNumber = confirmed.filter((d) => {
    const otherNum = d.extractedFields.find((f) => f.key === "documentNumber")?.value;
    return otherNum && documentNumber && normalize(otherNum) === normalize(documentNumber);
  });
  const dupByHash = siblings.filter(
    (d) => d.status === "ACTIVE" && d._id !== docId && d.sha256 === doc.sha256,
  );
  checks.push({
    check: "Duplicate Detection",
    status: dupByNumber.length === 0 && dupByHash.length === 0 ? "PASSED" : "FAILED",
    detail:
      dupByHash.length > 0
        ? "Identical file hash (SHA-256) already exists for this organization."
        : dupByNumber.length > 0
          ? "The same document/certificate number is already registered."
          : "No duplicate detected. This check only detects repeated files or identifiers; it does not prove authenticity.",
  });

  // overall validation status
  let validationStatus: Doc<"documents">["validationStatus"] = "PASSED";
  if (checks.some((c) => c.status === "FAILED")) validationStatus = "FAILED";
  else if (checks.some((c) => c.status === "WARNING")) validationStatus = "PARTIAL";

  const autoRevoke = documentTypeMismatch || identityMismatch || !nameOk || missing.length > 0 || !formatOk;

  // 7. Authenticity (prototype issuer registry)
  let verificationStatus: Doc<"documents">["verificationStatus"] = "AUTHENTICITY_UNAVAILABLE";
  let verificationDetail = "No reference number available for issuer lookup.";
  if (identityMismatch) {
    verificationStatus = "NEEDS_REVIEW";
    verificationDetail = "Identity-document content does not match the selected business document type; manual review required.";
  } else if (documentNumber) {
    const registry = await ctx.db
      .query("issuerRegistry")
      .withIndex("by_key", (q) => q.eq("registerKey", documentNumber.trim()))
      .first();
    if (registry) {
      if (registry.status === "ACTIVE") {
        verificationStatus = "VERIFIED";
        verificationDetail = `Verified against prototype issuer registry "${registry.registryName}" (${registry.authority}).`;
      } else {
        verificationStatus = "VERIFICATION_FAILED";
        verificationDetail = `Issuer record found but status is ${registry.status} in the prototype registry.`;
      }
    } else {
      verificationStatus = "NEEDS_REVIEW";
      verificationDetail =
        "Number not found in the prototype issuer registry (NOT_FOUND). Exact hash and cross-document checks still apply.";
    }
  } else if (doc.extractionStatus === "NO_OCR") {
    verificationStatus = "AUTHENTICITY_UNAVAILABLE";
    verificationDetail = "No OCR engine is configured for scanned/image documents; manual review required.";
  }

  if (validationStatus === "FAILED") {
    verificationStatus = verificationStatus === "VERIFIED" ? "VERIFIED" : verificationStatus;
  }

  await ctx.db.patch(docId, {
    status: autoRevoke ? "REVOKED" : doc.status,
    validationStatus,
    validationChecks: checks,
    verificationStatus,
    verificationDetail,
  } as never);
  if (autoRevoke) {
    const actor = await requireUser(ctx);
    await recordAudit(ctx, {
      actorId: actor._id,
      actorName: actor.name ?? actor.email ?? "Unknown",
      actorRole: actor.role ?? "",
      action: "DOCUMENT_REVOKED",
      entityType: "documents",
      entityId: doc._id,
      previousValue: "ACTIVE",
      newValue: "REVOKED",
      detail: "Automatically revoked because confirmed fields did not match the selected document profile.",
    });
  }
  return { validationStatus, verificationStatus, checks };
}

export const recordDocument = mutation({
  args: {
    applicationId: v.optional(v.id("applications")),
    organizationId: v.id("organizations"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.optional(v.string()),
    sha256: v.string(),
    extractionStatus: v.union(
      v.literal("PENDING"),
      v.literal("EXTRACTED"),
      v.literal("EXTRACTION_FAILED"),
      v.literal("NO_OCR"),
      v.literal("MANUAL_ENTRY"),
    ),
    extractedText: v.optional(v.string()),
    extractedFields: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        value: v.optional(v.string()),
        source: v.union(v.literal("extract"), v.literal("manual"), v.literal("confirmed")),
      }),
    ),
    documentType: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    // Ownership check
    if (user.role === ROLES.APPLICANT && user.organizationId !== args.organizationId)
      throw new ApprovalError("You cannot upload to another organization.", "FORBIDDEN");
    if (user.role !== ROLES.APPLICANT && ![ROLES.ADMIN, ROLES.DEPT_SUPERVISOR].includes(user.role as never))
      throw new ApprovalError("Forbidden.", "FORBIDDEN");

    // ---- server-side file validation ----
    if (!ALLOWED_MIME.has(args.mimeType.toLowerCase()))
      throw new ApprovalError("Unsupported file type. Accepted formats: PDF, PNG, JPG, JPEG.", "VALIDATION");
    if (args.size <= 0 || args.size > MAX_SIZE)
      throw new ApprovalError("File size must be between 1 byte and 15 MB.", "VALIDATION");
    if (!SHA256_RE.test(args.sha256))
      throw new ApprovalError("File hash must be a SHA-256 hex digest.", "VALIDATION");
    if (!args.storageId) throw new ApprovalError("Upload failed: no storage reference.", "VALIDATION");
    if (!(args.documentType && DOCUMENT_TYPES[args.documentType]))
      throw new ApprovalError("Select a valid document type.", "VALIDATION");
    if (args.extractedText && args.extractedText.length > 200_000)
      throw new ApprovalError("Extracted text is unexpectedly large; upload rejected.", "VALIDATION");

    // exact-hash duplicate detection
    const dup = await ctx.db
      .query("documents")
      .withIndex("by_sha256", (q) => q.eq("sha256", args.sha256))
      .first();
    if (dup && dup.organizationId === args.organizationId && dup.status === "ACTIVE") {
      await recordAudit(ctx, {
        actorId: user._id,
        actorName: user.name ?? user.email ?? "Unknown",
        actorRole: user.role ?? "",
        action: "DOCUMENT_UPLOAD_BLOCKED_DUPLICATE",
        entityType: "documents",
        entityId: dup._id,
        detail: "Upload blocked: identical SHA-256 already on file.",
      });
      throw new ApprovalError("Duplicate document: a file with the identical SHA-256 hash is already uploaded.", "DUPLICATE");
    }

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      organizationId: args.organizationId,
      applicationId: args.applicationId,
      uploadedBy: user._id,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      storageId: args.storageId,
      sha256: args.sha256,
      extractionStatus: args.extractionStatus,
      extractedText: args.extractedText,
      extractedFields: args.extractedFields,
      fieldsConfirmed: false,
      documentType: args.documentType,
      validationStatus: "PENDING",
      validationChecks: [],
      verificationStatus: "AUTHENTICITY_UNAVAILABLE",
      status: "ACTIVE",
      version: 1,
    } as never);

    await ctx.db.insert("documentVersions", {
      documentId: docId,
      version: 1,
      fileName: args.fileName,
      storageId: args.storageId,
      sha256: args.sha256,
      size: args.size,
      changedBy: user._id,
      changedAt: now,
      note: "Initial upload",
    } as never);

    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_UPLOADED",
      entityType: "documents",
      entityId: docId,
      newValue: { fileName: args.fileName, sha256: args.sha256, size: args.size },
      detail: `extraction: ${args.extractionStatus}`,
    });
    return { documentId: docId };
  },
});

/** Human confirmation of extracted fields (never silently accepted). */
export const confirmDocumentFields = mutation({
  args: {
    documentId: v.id("documents"),
    fields: v.array(
      v.object({ key: v.string(), label: v.string(), value: v.optional(v.string()) }),
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);

    const confirmed = args.fields.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.value ?? undefined,
      source: "confirmed" as const,
    }));
    await ctx.db.patch(doc._id, {
      extractedFields: confirmed as never,
      fieldsConfirmed: true,
      extractionStatus: doc.extractionStatus === "NO_OCR" || doc.extractionStatus === "EXTRACTION_FAILED" ? "MANUAL_ENTRY" : doc.extractionStatus,
    } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_FIELDS_CONFIRMED",
      entityType: "documents",
      entityId: doc._id,
      newValue: { fields: confirmed },
    });

    const result = await runValidation(ctx, doc._id);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_VALIDATION_RUN",
      entityType: "documents",
      entityId: doc._id,
      newValue: { validationStatus: result.validationStatus, verificationStatus: result.verificationStatus },
    });
    return result;
  },
});

export const rerunValidation = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    if (!doc.fieldsConfirmed)
      throw new ApprovalError("Confirm the extracted fields before running validation.", "NOT_CONFIRMED");
    const result = await runValidation(ctx, doc._id);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_VALIDATION_RUN",
      entityType: "documents",
      entityId: doc._id,
    });
    return result;
  },
});

/** Prototype issuer verification (explicitly labelled a simulation). */
export const verifyViaIssuerRegistry = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    if (!doc.fieldsConfirmed)
      throw new ApprovalError("Confirm extracted fields before issuer verification.", "NOT_CONFIRMED");
    const fields = docFieldMaps(doc);
    const number = fields.documentNumber;
    if (!number) {
      const r = await runValidation(ctx, doc._id);
      return r;
    }
    const registry = await ctx.db
      .query("issuerRegistry")
      .withIndex("by_key", (q) => q.eq("registerKey", number.trim()))
      .first();
    let verificationStatus: Doc<"documents">["verificationStatus"];
    let verificationDetail: string;
    if (registry && registry.status === "ACTIVE") {
      verificationStatus = "VERIFIED";
      verificationDetail = `Prototype issuer registry "${registry.registryName}" returned VERIFIED for ${number}.`;
    } else {
      verificationStatus = "NEEDS_REVIEW";
      verificationDetail = `Prototype issuer registry returned NOT_FOUND for ${number}. No live government connectivity is claimed.`;
    }
    await ctx.db.patch(doc._id, { verificationStatus, verificationDetail } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "ISSUER_VERIFICATION_ATTEMPT",
      entityType: "documents",
      entityId: doc._id,
      newValue: { verificationStatus, number },
      detail: "Prototype Verification Gateway — Simulation",
    });
    return { verificationStatus, verificationDetail };
  },
});

export const revokeDocument = mutation({
  args: { documentId: v.id("documents"), reason: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    if (doc.status !== "ACTIVE") throw new ApprovalError("Document is already revoked.", "INVALID_STATE");
    await ctx.db.patch(doc._id, { status: "REVOKED" } as never);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_REVOKED",
      entityType: "documents",
      entityId: doc._id,
      previousValue: "ACTIVE",
      newValue: "REVOKED",
      detail: args.reason,
    });
    return { ok: true };
  },
});

export const myDocuments = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const user = await requireUser(ctx);
    if (user.role === ROLES.APPLICANT && user.organizationId) {
      return await listOrgDocs(ctx, user.organizationId);
    }
    // department staff: all orgs' docs (compartment filtered by app)
    const apps = await ctx.db.query("applications").collect();
    const allowedAppIds = new Set<string>();
    const userDept = user.department;
    for (const a of apps) {
      if (user.role === ROLES.ADMIN || user.role === ROLES.DEPT_SUPERVISOR || !userDept || a.department === userDept)
        allowedAppIds.add(a._id);
    }
    const all = await ctx.db.query("documents").collect();
    const filtered = all.filter(
      (d) => d.status === "ACTIVE" && d.validationStatus !== "FAILED" && (!d.applicationId || allowedAppIds.has(d.applicationId)),
    );
    return stripText(filtered);
  },
});

export const listOrgDocs = async (ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) => {
  const docs = await ctx.db
    .query("documents")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();
  return stripText(docs.filter((doc) => doc.status === "ACTIVE" && doc.validationStatus !== "FAILED"));
};

function stripText(docs: Doc<"documents">[]) {
  return docs
    .sort((a, b) => b._creationTime - a._creationTime)
    .map(({ extractedText: _drop, ...rest }) => rest);
}

export const getDocumentUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    if (doc.status !== "ACTIVE") throw new ApprovalError("This document has been revoked.", "INVALID_STATE");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    if (!doc.storageId) return { url: null, reason: "Demo records have no physical file attached." };
    const url = await ctx.storage.getUrl(doc.storageId);
    return { url, reason: null };
  },
});

export const logDocumentAccess = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx: MutationCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    await recordAudit(ctx, {
      actorId: user._id,
      actorName: user.name ?? user.email ?? "Unknown",
      actorRole: user.role ?? "",
      action: "DOCUMENT_ACCESSED",
      entityType: "documents",
      entityId: doc._id,
      detail: doc.fileName,
    });
    return { ok: true };
  },
});

export const documentVersions = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx: QueryCtx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ApprovalError("Document not found.", "NOT_FOUND");
    await canSeeApplicationDocs(ctx, doc.applicationId ?? null, doc.organizationId);
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    return { doc: stripText([doc])[0], versions: versions.sort((a, b) => b.version - a.version) };
  },
});