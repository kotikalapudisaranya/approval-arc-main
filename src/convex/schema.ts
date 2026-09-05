import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Roles & shared enums
// ---------------------------------------------------------------------------

export const ROLES = {
  APPLICANT: "applicant",
  DEPT_OFFICER: "dept_officer",
  DEPT_SUPERVISOR: "dept_supervisor",
  ADMIN: "admin",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.APPLICANT),
  v.literal(ROLES.DEPT_OFFICER),
  v.literal(ROLES.DEPT_SUPERVISOR),
  v.literal(ROLES.ADMIN),
);
export type Role = Infer<typeof roleValidator>;

/** Applicability evaluation status (Approval Intelligence Engine). */
export const evalStatusValidator = v.union(
  v.literal("APPLICABLE"),
  v.literal("NOT_APPLICABLE"),
  v.literal("CONDITIONAL"),
  v.literal("READY"),
  v.literal("BLOCKED"),
);
export type EvalStatus = Infer<typeof evalStatusValidator>;

/** Regulatory rule lifecycle. */
export const ruleStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("PENDING_VERIFICATION"),
  v.literal("ACTIVE"),
  v.literal("SUPERSEDED"),
  v.literal("EXPIRED"),
);
export type RuleStatus = Infer<typeof ruleStatusValidator>;

/** Application workflow state machine. */
export const appStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("READY_FOR_SUBMISSION"),
  v.literal("SUBMITTED"),
  v.literal("UNDER_REVIEW"),
  v.literal("QUERY_RAISED"),
  v.literal("WAITING_FOR_APPLICANT"),
  v.literal("RESUBMITTED"),
  v.literal("INSPECTION_REQUIRED"),
  v.literal("INSPECTION_SCHEDULED"),
  v.literal("DECISION_PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
);
export type AppStatus = Infer<typeof appStatusValidator>;

export const documentValidationStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("PASSED"),
  v.literal("PARTIAL"),
  v.literal("FAILED"),
);
export const documentVerificationStatusValidator = v.union(
  v.literal("VERIFIED"),
  v.literal("NEEDS_REVIEW"),
  v.literal("DUPLICATE"),
  v.literal("VERIFICATION_FAILED"),
  v.literal("AUTHENTICITY_UNAVAILABLE"),
);
export const extractionStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("EXTRACTED"),
  v.literal("EXTRACTION_FAILED"),
  v.literal("NO_OCR"),
  v.literal("MANUAL_ENTRY"),
);

export const queryStatusValidator = v.union(
  v.literal("OPEN"),
  v.literal("RESPONDED"),
  v.literal("RESOLVED"),
  v.literal("REOPENED"),
);

export const inspectionStatusValidator = v.union(
  v.literal("REQUIRED"),
  v.literal("SCHEDULED"),
  v.literal("COMPLETED"),
  v.literal("CANCELLED"),
  v.literal("RESCHEDULED"),
);

export const slaStatusValidator = v.union(
  v.literal("ON_TRACK"),
  v.literal("AT_RISK"),
  v.literal("BREACHED"),
);

export const complianceStatusValidator = v.union(
  v.literal("UPCOMING"),
  v.literal("DUE_SOON"),
  v.literal("OVERDUE"),
  v.literal("COMPLETED"),
);

export const schemeStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("CLOSING_SOON"),
  v.literal("UPCOMING"),
  v.literal("CLOSED"),
  v.literal("SUSPENDED"),
  v.literal("HISTORICAL"),
);

export const schemeMatchValidator = v.union(
  v.literal("CRITERIA_MATCH"),
  v.literal("POTENTIAL_MATCH"),
  v.literal("NOT_MATCHED"),
);

export const gatewayStatusValidator = v.union(
  v.literal("RECEIVED"),
  v.literal("UNDER_REVIEW"),
  v.literal("QUERY_RAISED"),
  v.literal("INSPECTION_REQUIRED"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
);

export const gatewayModeValidator = v.union(
  v.literal("OFFICIAL_API"),
  v.literal("FILE_EXCHANGE"),
  v.literal("PORTAL_HANDOFF"),
  v.literal("MANUAL_STATUS"),
  v.literal("MOCK"),
);

// ---------------------------------------------------------------------------
// Reusable nested validators
// ---------------------------------------------------------------------------

/** A single deterministic condition (field op value). */
export const conditionValidator = v.object({
  field: v.string(),
  op: v.union(
    v.literal("eq"),
    v.literal("ne"),
    v.literal("gte"),
    v.literal("lte"),
    v.literal("in"),
    v.literal("contains"),
  ),
  value: v.union(v.string(), v.number(), v.boolean(), v.null()),
});

/** Post-approval compliance obligation definition. */
export const obligationValidator = v.object({
  type: v.union(
    v.literal("RENEWAL"),
    v.literal("PERIODIC_FILING"),
    v.literal("INSPECTION"),
    v.literal("CERTIFICATE_UPDATE"),
    v.literal("PERIODIC_REPORT"),
  ),
  title: v.string(),
  description: v.string(),
  /** e.g. 12 for annually recurring. 0/undefined = single occurrence. */
  frequencyMonths: v.optional(v.number()),
  /** Days after approval when the first obligation is due. */
  dueOffsetDays: v.optional(v.number()),
});

export const changeHistoryValidator = v.object({
  at: v.number(),
  actor: v.string(),
  note: v.string(),
});

export type Condition = Infer<typeof conditionValidator>;
export type Obligation = Infer<typeof obligationValidator>;
export type SlaStatus = Infer<typeof slaStatusValidator>;
export type QueryStatus = Infer<typeof queryStatusValidator>;
export type InspectionStatus = Infer<typeof inspectionStatusValidator>;
export type GatewayStatus = Infer<typeof gatewayStatusValidator>;
export type GatewayMode = Infer<typeof gatewayModeValidator>;
export type ExtractionStatus = Infer<typeof extractionStatusValidator>;

export const auditEntryValidator = v.object({
  actorId: v.optional(v.id("users")),
  actorName: v.string(),
  actorRole: v.string(),
  action: v.string(),
  entityType: v.string(),
  entityId: v.optional(v.string()),
  previousValue: v.optional(v.any()),
  newValue: v.optional(v.any()),
  detail: v.optional(v.string()),
  context: v.optional(v.string()),
  occurredAt: v.number(),
});

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      department: v.optional(v.string()),
      employeeId: v.optional(v.string()),
      organizationId: v.optional(v.id("organizations")),
    }).index("email", ["email"]),

    organizations: defineTable({
      name: v.string(),
      ownerId: v.id("users"),
      contactName: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      address: v.optional(v.string()),
    }),

    /** Business profile — the input to the deterministic rule engine. */
    businessProfiles: defineTable({
      organizationId: v.id("organizations"),
      businessType: v.string(),
      sector: v.string(),
      state: v.string(),
      district: v.string(),
      projectType: v.string(),
      projectStage: v.string(),
      /** investment in ₹ lakh */
      investment: v.number(),
      employeeCount: v.number(),
      premisesOwnership: v.optional(v.string()),
      landArea: v.optional(v.string()),
      operationalConditions: v.array(v.string()),
    }).index("by_organization", ["organizationId"]),

    /** Approved source records feeding candidate rules. */
    regulatorySources: defineTable({
      title: v.string(),
      authority: v.string(),
      url: v.string(),
      publicationDate: v.optional(v.number()),
      retrievedAt: v.optional(v.number()),
      rawExcerpt: v.optional(v.string()),
    }),

    /**
     * Reusable regulatory rules. State/sector/conditions compose dynamically
     * against a business profile. Only ACTIVE + verified rules affect
     * applicability. New versions are inserted as new rows (same ruleId,
     * version + 1); superseded rules keep their history.
     */
    regulatoryRules: defineTable({
      ruleId: v.string(),
      title: v.string(),
      jurisdiction: v.string(),
      state: v.string(),
      districtScope: v.optional(v.string()),
      sector: v.string(),
      activity: v.string(),
      approvalType: v.string(),
      projectConditions: v.array(v.string()),
      conditions: v.array(conditionValidator),
      requiredInformation: v.array(v.string()),
      requiredDocuments: v.array(v.string()),
      prerequisites: v.array(v.string()),
      dependencies: v.array(v.string()),
      parallelizable: v.boolean(),
      slaWorkingDays: v.number(),
      validityDays: v.number(),
      renewalRules: v.string(),
      officialAuthority: v.string(),
      officialSource: v.string(),
      publicationDate: v.number(),
      effectiveDate: v.number(),
      expiryDate: v.optional(v.number()),
      supersedes: v.optional(v.string()),
      version: v.number(),
      verificationStatus: ruleStatusValidator,
      reviewer: v.optional(v.string()),
      lastVerified: v.optional(v.number()),
      changeHistory: v.array(changeHistoryValidator),
      postApprovalObligations: v.array(obligationValidator),
    }).index("by_ruleId", ["ruleId"]).index("by_status", ["verificationStatus"]),

    /** Snapshot of the engine output per organization + profile. */
    approvalEvals: defineTable({
      organizationId: v.id("organizations"),
      businessProfileId: v.id("businessProfiles"),
      ruleId: v.string(),
      ruleVersion: v.number(),
      title: v.string(),
      authority: v.string(),
      status: evalStatusValidator,
      triggers: v.array(
        v.object({ field: v.string(), op: v.string(), value: v.any(), matched: v.boolean() }),
      ),
      reason: v.optional(v.string()),
      evaluatedAt: v.number(),
    })
      .index("by_organization", ["organizationId"])
      .index("by_rule", ["ruleId"]),

    applications: defineTable({
      organizationId: v.id("organizations"),
      businessProfileId: v.id("businessProfiles"),
      ruleId: v.string(),
      approvalTitle: v.string(),
      authority: v.string(),
      department: v.string(),
      status: appStatusValidator,
      slaWorkingDays: v.number(),
      submittedAt: v.optional(v.number()),
      governmentRefId: v.optional(v.string()),
      assignedOfficerId: v.optional(v.id("users")),
      decisionAt: v.optional(v.number()),
      decisionBy: v.optional(v.id("users")),
      pauseStart: v.optional(v.number()),
      pauseIntervals: v.array(
        v.object({ start: v.number(), end: v.optional(v.number()) }),
      ),
      applicantWaitMs: v.number(),
      lastSlaStatus: v.optional(slaStatusValidator),
      readyForSubmissionAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      internalNote: v.optional(v.string()),
    })
      .index("by_organization", ["organizationId"])
      .index("by_status", ["status"])
      .index("by_department", ["department"])
      .index("by_ref", ["governmentRefId"]),

    applicationEvents: defineTable({
      applicationId: v.id("applications"),
      eventType: v.string(),
      actorId: v.optional(v.id("users")),
      actorName: v.string(),
      from: v.optional(v.string()),
      to: v.optional(v.string()),
      detail: v.optional(v.string()),
      /** occurring at (explicit, supports seeded past events) */
      occurredAt: v.number(),
      /** applicant-visible vs internal only */
      visibility: v.union(v.literal("APPLICANT_VISIBLE"), v.literal("INTERNAL_ONLY")),
    }).index("by_application", ["applicationId"]),

    documents: defineTable({
      organizationId: v.id("organizations"),
      applicationId: v.optional(v.id("applications")),
      uploadedBy: v.id("users"),
      fileName: v.string(),
      mimeType: v.string(),
      size: v.number(),
      storageId: v.optional(v.string()),
      sha256: v.string(),
      extractionStatus: extractionStatusValidator,
      extractedText: v.optional(v.string()),
      extractedFields: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          value: v.optional(v.string()),
          source: v.union(v.literal("extract"), v.literal("manual"), v.literal("confirmed")),
        }),
      ),
      fieldsConfirmed: v.boolean(),
      documentType: v.optional(v.string()),
      validationStatus: documentValidationStatusValidator,
      validationChecks: v.array(
        v.object({
          check: v.string(),
          status: v.union(v.literal("PASSED"), v.literal("FAILED"), v.literal("WARNING"), v.literal("N/A")),
          detail: v.string(),
        }),
      ),
      verificationStatus: documentVerificationStatusValidator,
      verificationDetail: v.optional(v.string()),
      status: v.union(v.literal("ACTIVE"), v.literal("REVOKED")),
      version: v.number(),
    })
      .index("by_organization", ["organizationId"])
      .index("by_application", ["applicationId"])
      .index("by_sha256", ["sha256"]),

    documentVersions: defineTable({
      documentId: v.id("documents"),
      version: v.number(),
      fileName: v.string(),
      storageId: v.optional(v.string()),
      sha256: v.string(),
      size: v.number(),
      changedBy: v.id("users"),
      changedAt: v.number(),
      note: v.optional(v.string()),
    }).index("by_document", ["documentId"]),

    queries: defineTable({
      applicationId: v.id("applications"),
      title: v.string(),
      reason: v.string(),
      requestedInformation: v.string(),
      responseDeadline: v.optional(v.number()),
      internalNote: v.optional(v.string()),
      message: v.string(),
      status: queryStatusValidator,
      raisedBy: v.id("users"),
      raisedAt: v.number(),
    }).index("by_application", ["applicationId"]).index("by_status", ["status"]),

    queryResponses: defineTable({
      queryId: v.id("queries"),
      applicationId: v.id("applications"),
      response: v.string(),
      attachmentDocumentId: v.optional(v.id("documents")),
      respondedBy: v.id("users"),
      respondedAt: v.number(),
    }).index("by_query", ["queryId"]),

    inspections: defineTable({
      applicationId: v.id("applications"),
      type: v.string(),
      purpose: v.string(),
      location: v.optional(v.string()),
      scheduledDate: v.optional(v.number()),
      inspectorName: v.optional(v.string()),
      status: inspectionStatusValidator,
      outcome: v.optional(v.string()),
      internalNotes: v.optional(v.string()),
      applicantNotes: v.optional(v.string()),
      requestedBy: v.id("users"),
      requestedAt: v.number(),
      completedAt: v.optional(v.number()),
    }).index("by_application", ["applicationId"]).index("by_status", ["status"]),

    slaRecords: defineTable({
      applicationId: v.id("applications"),
      appliedRuleDays: v.number(),
      grossElapsedMs: v.number(),
      officialElapsedMs: v.number(),
      applicantWaitMs: v.number(),
      remainingMs: v.optional(v.number()),
      status: slaStatusValidator,
      computedAt: v.number(),
      note: v.optional(v.string()),
    }).index("by_application", ["applicationId"]),

    complianceObligations: defineTable({
      organizationId: v.id("organizations"),
      applicationId: v.id("applications"),
      ruleId: v.string(),
      title: v.string(),
      authority: v.string(),
      type: v.string(),
      source: v.string(),
      frequencyMonths: v.optional(v.number()),
      dueDate: v.number(),
      status: complianceStatusValidator,
      responsiblePerson: v.optional(v.string()),
      lastCompletedAt: v.optional(v.number()),
    })
      .index("by_organization", ["organizationId"])
      .index("by_status", ["status"]),

    schemes: defineTable({
      schemeId: v.string(),
      name: v.string(),
      authority: v.string(),
      sector: v.string(),
      state: v.string(),
      eligibilityCriteria: v.array(v.string()),
      benefits: v.array(v.string()),
      applicationMethod: v.string(),
      openingDate: v.optional(v.number()),
      closingDate: v.optional(v.number()),
      officialSource: v.string(),
      status: schemeStatusValidator,
      maxInvestmentLakh: v.optional(v.number()),
      minInvestmentLakh: v.optional(v.number()),
      maxEmployees: v.optional(v.number()),
      minEmployees: v.optional(v.number()),
      projectTypesAllowed: v.array(v.string()),
      matchCriteria: v.array(conditionValidator),
    }).index("by_status", ["status"]),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      message: v.string(),
      type: v.union(
        v.literal("SLA"),
        v.literal("QUERY"),
        v.literal("DOCUMENT"),
        v.literal("INSPECTION"),
        v.literal("DECISION"),
        v.literal("SYSTEM"),
      ),
      read: v.boolean(),
      link: v.optional(v.string()),
    }).index("by_user", ["userId"]).index("by_user_read", ["userId", "read"]),

    auditLogs: defineTable(auditEntryValidator)
      .index("by_entity", ["entityType", "entityId"])
      .index("by_actor", ["actorId"]),

    issuerRegistry: defineTable({
      registryName: v.string(),
      authority: v.string(),
      lookupType: v.union(v.literal("CERTIFICATE_NUMBER"), v.literal("REGISTRATION_NUMBER")),
      registerKey: v.string(),
      businessName: v.optional(v.string()),
      issueDate: v.optional(v.number()),
      expiryDate: v.optional(v.number()),
      status: v.union(v.literal("ACTIVE"), v.literal("INACTIVE"), v.literal("SUSPENDED")),
      sourceNote: v.string(),
    }).index("by_key", ["registerKey"]),

    governmentSubmissions: defineTable({
      applicationId: v.id("applications"),
      governmentRefId: v.string(),
      gatewayMode: gatewayModeValidator,
      status: gatewayStatusValidator,
      submittedAt: v.number(),
      lastSyncAt: v.number(),
      rawResponse: v.optional(v.string()),
      isSimulation: v.boolean(),
    }).index("by_application", ["applicationId"]),

    workingCalendars: defineTable({
      jurisdiction: v.string(),
      state: v.optional(v.string()),
      name: v.string(),
      workDays: v.array(
        v.union(
          v.literal("MON"),
          v.literal("TUE"),
          v.literal("WED"),
          v.literal("THU"),
          v.literal("FRI"),
          v.literal("SAT"),
          v.literal("SUN"),
        ),
      ),
      /** holiday timestamps (ms, midnight) */
      holidays: v.array(v.number()),
    }).index("by_jurisdiction", ["jurisdiction"]),

    consents: defineTable({
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      purpose: v.string(),
      scope: v.string(),
      grantedAt: v.number(),
      status: v.union(v.literal("GRANTED"), v.literal("REVOKED")),
    }).index("by_organization", ["organizationId"]),

    settings: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;