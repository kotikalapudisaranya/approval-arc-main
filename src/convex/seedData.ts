// ---------------------------------------------------------------------------
// Demo dataset — internal mutation. Writes the curated prototype dataset:
// rules, schemes, issuer registry, calendars, GreenHarvest org/profile, and a
// realistic application landscape (draft / at-risk with query + inspection /
// approved with compliance / blocked). Clearly labelled demo data only.
// ---------------------------------------------------------------------------
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { recordAudit } from "./lib/authz";
import { DEMO_RULES } from "./seed/rules";
import { DEMO_SCHEMES } from "./seed/schemes";
import { generateComplianceForApprovedApp } from "./compliance";

const DAY = 24 * 60 * 60 * 1000;

function workingDaysAgo(n: number) {
  return Date.now() - Math.round(n * 1.4) * DAY;
}
function futureWorking(days: number) {
  return Date.now() + Math.round(days * 1.4) * DAY;
}

export const isSeededInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "demo_seeded"))
      .first();
    return !!s;
  },
});

export type SeedDataResult = {
  organizationId: Id<"organizations">;
  businessProfileId: Id<"businessProfiles">;
  applicationIds: {
    udyamId: Id<"applications">;
    cteId: Id<"applications">;
    factoryId: Id<"applications">;
    ctoId: Id<"applications">;
    fssaiId: Id<"applications">;
  };
  rules: number;
  schemes: number;
};

export const isDemoSeeded = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const s = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "demo_seeded"))
      .first();
    return !!s;
  },
});

export const seedDataMutation = internalMutation({
  args: {
    applicantId: v.id("users"),
    officerId: v.id("users"),
    supervisorId: v.id("users"),
    adminId: v.id("users"),
  },
  handler: async (ctx: MutationCtx, args) => {
    // guard: never double-seed
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "demo_seeded"))
      .first();
    if (existing) return { skipped: true, reason: "already seeded" };

    const now = Date.now();
    const applicant = await ctx.db.get(args.applicantId);
    const officer = await ctx.db.get(args.officerId);
    const supervisor = await ctx.db.get(args.supervisorId);
    const admin = await ctx.db.get(args.adminId);
    if (!applicant || !officer || !supervisor || !admin)
      throw new Error("Demo accounts were not created.");

    // set roles / departments on the demo users
    await ctx.db.patch(applicant._id, { role: "applicant" } as never);
    await ctx.db.patch(officer._id, {
      role: "dept_officer",
      department: "Maharashtra Pollution Control Board",
      employeeId: "EMP-MPCB-1042",
    } as never);
    await ctx.db.patch(supervisor._id, {
      role: "dept_supervisor",
      department: "Maharashtra Pollution Control Board",
      employeeId: "EMP-MPCB-0007",
    } as never);
    await ctx.db.patch(admin._id, { role: "admin" } as never);

    // ------------------------------------------------- demo organization
    const orgId = await ctx.db.insert("organizations", {
      name: "GreenHarvest Foods Pvt. Ltd.",
      ownerId: applicant._id,
      contactName: "Demo Applicant",
      contactEmail: "demo.applicant@approvalarc.in",
      contactPhone: "+91 98XXXXXX00",
      address: "Plot 21, MIDC Bhosari, Pune, Maharashtra 411026",
    } as never);
    await ctx.db.patch(applicant._id, { organizationId: orgId } as never);

    const profileId = await ctx.db.insert("businessProfiles", {
      organizationId: orgId,
      businessType: "Private Limited Company",
      sector: "Food Processing",
      state: "Maharashtra",
      district: "Pune",
      projectType: "New Manufacturing Unit",
      projectStage: "Commissioning",
      investment: 500, // ₹5 crore = 500 lakh
      employeeCount: 80,
      premisesOwnership: "Leased (MIDC industrial plot)",
      landArea: "4,000 sqm",
      operationalConditions: ["Packaged Goods Sales", "Steam Boiler Installed", "Groundwater Extraction", "Hazardous Waste Generated"],
    } as never);
    const profile = (await ctx.db.get(profileId)) as Doc<"businessProfiles">;

    // ---------------------------------------------------------------- rules
    for (const r of DEMO_RULES) {
      await ctx.db.insert("regulatoryRules", r as never);
    }
    await ctx.db.insert("regulatorySources", {
      title: "Prototype curated source — Maharashtra Food Processing approvals",
      authority: "Multiple (see each rule)",
      url: "https://example.in/prototype-source",
      publicationDate: now - 120 * DAY,
      retrievedAt: now - 15 * DAY,
      rawExcerpt: "Curated demo dataset for SIH 2026; not an official legal record.",
    } as never);

    // ------------------------------------------------------------- schemes
    for (const s of DEMO_SCHEMES) {
      await ctx.db.insert("schemes", s as never);
    }

    // ------------------------------------------------- working calendars
    await ctx.db.insert("workingCalendars", {
      jurisdiction: "INDIA",
      name: "National working calendar (Mon–Fri)",
      workDays: ["MON", "TUE", "WED", "THU", "FRI"],
      holidays: [],
    } as never);
    await ctx.db.insert("workingCalendars", {
      jurisdiction: "STATE:Maharashtra",
      state: "Maharashtra",
      name: "Maharashtra working calendar (Mon–Fri)",
      workDays: ["MON", "TUE", "WED", "THU", "FRI"],
      holidays: [],
    } as never);

    // ------------------------------------------------------ issuer registry
    await ctx.db.insert("issuerRegistry", {
      registryName: "Udyam Registration Prototype Lookup",
      authority: "Directorate of Industries, Maharashtra (prototype)",
      lookupType: "REGISTRATION_NUMBER",
      registerKey: "UDYAM-MH-08-0123456",
      businessName: "GreenHarvest Foods Pvt. Ltd.",
      issueDate: now - 200 * DAY,
      status: "ACTIVE",
      sourceNote: "Prototype issuer registry — simulation, not a live government connection.",
    } as never);
    await ctx.db.insert("issuerRegistry", {
      registryName: "FSSAI Licence Prototype Lookup",
      authority: "FSSAI (prototype)",
      lookupType: "CERTIFICATE_NUMBER",
      registerKey: "FSSAI-21524121000000",
      businessName: "GreenHarvest Foods Pvt. Ltd.",
      issueDate: now - 240 * DAY,
      expiryDate: futureWorking(1500),
      status: "ACTIVE",
      sourceNote: "Prototype issuer registry — simulation, not a live government connection.",
    } as never);

    // ------------------------------------------------------------ helpers
    let seq = 1000;
    const doc = async (d: {
      applicationId?: Id<"applications">;
      documentType: string;
      fileName: string;
      businessName: string;
      documentNumber: string;
      issueDate?: number;
      expiryDate?: number;
      verified: boolean;
      confirmed: boolean;
      requiresReview?: boolean;
    }) => {
      const id = `doc-${seq++}`;
      const fields = [
        { key: "businessName", label: "Business Name", value: d.businessName, source: "confirmed" as const },
        { key: "documentNumber", label: "Document / Certificate Number", value: d.documentNumber, source: "confirmed" as const },
        { key: "issueDate", label: "Issue Date", value: d.issueDate ? new Date(d.issueDate).toISOString().slice(0, 10) : undefined, source: "confirmed" as const },
        ...(d.expiryDate ? [{ key: "expiryDate", label: "Expiry Date", value: new Date(d.expiryDate).toISOString().slice(0, 10), source: "confirmed" as const }] : []),
      ];
      await ctx.db.insert("documents", {
        organizationId: orgId,
        applicationId: d.applicationId,
        uploadedBy: applicant._id,
        fileName: d.fileName,
        mimeType: "application/pdf",
        size: 240_000,
        sha256: sha(id),
        extractionStatus: "EXTRACTED",
        extractedText: `${d.businessName}\n${d.documentNumber}`,
        extractedFields: d.requiresReview
          ? [{ key: "businessName", label: "Business Name", value: d.businessName, source: "extract" as const }]
          : (fields as never),
        fieldsConfirmed: d.confirmed,
        documentType: d.documentType,
        validationStatus: d.requiresReview ? "PENDING" : d.verified ? "PASSED" : "PARTIAL",
        validationChecks: [],
        verificationStatus: d.requiresReview
          ? "NEEDS_REVIEW"
          : d.verified
            ? "VERIFIED"
            : "AUTHENTICITY_UNAVAILABLE",
        verificationDetail: d.requiresReview
          ? "Prototype issuer registry returned NOT_FOUND for the reference number."
          : d.verified
            ? "Verified against prototype issuer registry."
            : "Demo record; issuer verification unavailable.",
        status: "ACTIVE",
        version: 1,
      } as never);
      return id;
    };

    const appEvent = (
      applicationId: Id<"applications">,
      e: {
        eventType: string;
        actorName: string;
        actorId: Id<"users">;
        from?: string;
        to?: string;
        detail?: string;
        at: number;
        visibility?: "APPLICANT_VISIBLE" | "INTERNAL_ONLY";
      },
    ) =>
      ctx.db.insert("applicationEvents", {
        applicationId,
        eventType: e.eventType,
        actorId: e.actorId,
        actorName: e.actorName,
        from: e.from,
        to: e.to,
        detail: e.detail,
        occurredAt: e.at,
        visibility: e.visibility ?? "APPLICANT_VISIBLE",
      } as never);

    const seedSla = (applicationId: Id<"applications">, days: number, status: string, at: number) =>
      ctx.db.insert("slaRecords", {
        applicationId,
        appliedRuleDays: days,
        grossElapsedMs: at,
        officialElapsedMs: at,
        applicantWaitMs: 0,
        remainingMs: 0,
        status,
        computedAt: at,
      } as never);

    const activeRule = async (ruleId: string): Promise<Doc<"regulatoryRules"> | null> => {
      const rules = await ctx.db.query("regulatoryRules").collect();
      const versions = rules.filter((r) => r.ruleId === ruleId && r.verificationStatus === "ACTIVE");
      versions.sort((a, b) => b.version - a.version);
      return versions[0] ?? null;
    };

    // ============================================ APP 1: Udyam (APPROVED)
    const udyamId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profileId,
      ruleId: "MH-FP-001",
      approvalTitle: "Udyam / MSME Business Registration",
      authority: "Directorate of Industries, Govt. of Maharashtra",
      department: "Industries & Commerce",
      status: "APPROVED",
      slaWorkingDays: 7,
      submittedAt: workingDaysAgo(30),
      governmentRefId: "MH-GATE-UDYAM-0001",
      pauseIntervals: [],
      applicantWaitMs: 0,
      decisionAt: workingDaysAgo(28),
      decisionBy: supervisor._id,
      lastSlaStatus: "ON_TRACK",
    } as never);
    await appEvent(udyamId, { eventType: "APPLICATION_CREATED", actorName: "Demo Applicant", actorId: applicant._id, to: "DRAFT", detail: "Created draft", at: workingDaysAgo(32) });
    await appEvent(udyamId, { eventType: "APPLICATION_SUBMITTED", actorName: "Demo Applicant", actorId: applicant._id, from: "READY_FOR_SUBMISSION", to: "SUBMITTED", detail: "Reference MH-GATE-UDYAM-0001", at: workingDaysAgo(30) });
    await appEvent(udyamId, { eventType: "APPLICATION_APPROVED", actorName: "Demo Supervisor", actorId: supervisor._id, from: "DECISION_PENDING", to: "APPROVED", detail: "Approved by department", at: workingDaysAgo(28) });
    await seedSla(udyamId, 7, "ON_TRACK", workingDaysAgo(28));
    await ctx.db.insert("governmentSubmissions", {
      applicationId: udyamId,
      governmentRefId: "MH-GATE-UDYAM-0001",
      gatewayMode: "MOCK",
      status: "APPROVED",
      submittedAt: workingDaysAgo(30),
      lastSyncAt: workingDaysAgo(28),
      rawResponse: "MOCK_GATEWAY: approved",
      isSimulation: true,
    } as never);
    await doc({
      applicationId: udyamId, documentType: "udyam",
      fileName: "udyam-certificate.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "UDYAM-MH-08-0123456", issueDate: now - 200 * DAY,
      verified: true, confirmed: true,
    });
    await doc({
      applicationId: udyamId, documentType: "pan",
      fileName: "pan-card.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "PAN-AAHCG1234Q", issueDate: now - 400 * DAY,
      verified: false, confirmed: true,
    });
    const udyamRule = await activeRule("MH-FP-001");
    if (udyamRule) {
      await generateComplianceForApprovedApp(ctx, udyamId as never, udyamRule, workingDaysAgo(28));
    }

    // ============================ APP 2: CTE (AT RISK + query + inspection)
    const cteId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profileId,
      ruleId: "MH-FP-003",
      approvalTitle: "Consent to Establish (CTE)",
      authority: "Maharashtra Pollution Control Board (MPCB)",
      department: "Maharashtra Pollution Control Board",
      status: "INSPECTION_REQUIRED",
      slaWorkingDays: 30,
      submittedAt: workingDaysAgo(20),
      governmentRefId: "MH-GATE-CTE-2214",
      assignedOfficerId: officer._id,
      pauseIntervals: [{ start: workingDaysAgo(15), end: workingDaysAgo(13) }],
      applicantWaitMs: 2 * DAY,
      lastSlaStatus: "AT_RISK",
    } as never);
    await appEvent(cteId, { eventType: "APPLICATION_CREATED", actorName: "Demo Applicant", actorId: applicant._id, to: "DRAFT", detail: "Created draft", at: workingDaysAgo(22) });
    await appEvent(cteId, { eventType: "APPLICATION_SUBMITTED", actorName: "Demo Applicant", actorId: applicant._id, from: "READY_FOR_SUBMISSION", to: "SUBMITTED", detail: "Reference MH-GATE-CTE-2214", at: workingDaysAgo(20) });
    await appEvent(cteId, { eventType: "REVIEW_STARTED", actorName: "Demo Officer", actorId: officer._id, from: "SUBMITTED", to: "UNDER_REVIEW", detail: "Review started", at: workingDaysAgo(18) });
    await appEvent(cteId, { eventType: "QUERY_RAISED", actorName: "Demo Officer", actorId: officer._id, to: "QUERY_RAISED", detail: "Clarify effluent treatment details", at: workingDaysAgo(15) });
    await appEvent(cteId, { eventType: "APPLICANT_RESPONSE", actorName: "Demo Applicant", actorId: applicant._id, from: "QUERY_RAISED", to: "RESUBMITTED", detail: "Provided ETP plan", at: workingDaysAgo(13) });
    await appEvent(cteId, { eventType: "INSPECTION_REQUIRED", actorName: "Demo Officer", actorId: officer._id, to: "INSPECTION_REQUIRED", detail: "Site inspection required", at: workingDaysAgo(5) });
    const q1 = await ctx.db.insert("queries", {
      applicationId: cteId,
      title: "Effluent treatment details",
      reason: "Information incomplete in submitted documents",
      requestedInformation: "ETP design capacity and vendor details",
      responseDeadline: workingDaysAgo(11),
      internalNote: "Internal: verify ETP vendor against approved list.",
      message: "Please provide the design capacity and vendor details of your proposed effluent treatment plant.",
      status: "RESOLVED",
      raisedBy: officer._id,
      raisedAt: workingDaysAgo(15),
    } as never);
    await ctx.db.insert("queryResponses", {
      queryId: q1,
      applicationId: cteId,
      response: "Our ETP has a design capacity of 30 KLD and is supplied by AquaClean Systems Pvt. Ltd.",
      respondedBy: applicant._id,
      respondedAt: workingDaysAgo(13),
    } as never);
    await ctx.db.insert("inspections", {
      applicationId: cteId,
      type: "Site / ETP inspection",
      purpose: "Verify effluent treatment infrastructure at plot",
      location: "Plot 21, MIDC Bhosari, Pune",
      status: "REQUIRED",
      internalNotes: "Internal: verify groundwater recharge plan; confirm plot boundary.",
      applicantNotes: "The department has marked a site inspection as required for this application.",
      requestedBy: officer._id,
      requestedAt: workingDaysAgo(5),
    } as never);
    await seedSla(cteId, 30, "AT_RISK", workingDaysAgo(1));
    await ctx.db.insert("governmentSubmissions", {
      applicationId: cteId,
      governmentRefId: "MH-GATE-CTE-2214",
      gatewayMode: "MOCK",
      status: "INSPECTION_REQUIRED",
      submittedAt: workingDaysAgo(20),
      lastSyncAt: workingDaysAgo(1),
      rawResponse: "MOCK_GATEWAY: inspection required",
      isSimulation: true,
    } as never);
    await doc({
      applicationId: cteId, documentType: "udyam",
      fileName: "udyam-certificate.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "UDYAM-MH-08-0123456", issueDate: now - 200 * DAY,
      verified: true, confirmed: true,
    });
    await doc({
      applicationId: cteId, documentType: "factory_plan",
      fileName: "factory-layout.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "LAYOUT-PMC-2026-1187", issueDate: workingDaysAgo(60),
      verified: false, confirmed: true,
    });
    await doc({
      applicationId: cteId, documentType: "site_plan",
      fileName: "site-plan.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "SITE-MIDC-2210", issueDate: workingDaysAgo(90),
      verified: false, confirmed: true,
    });
    await doc({
      applicationId: cteId, documentType: "water_consent_form",
      fileName: "water-consent.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "WCF-PUNE-7712", issueDate: workingDaysAgo(10),
      verified: false, confirmed: false, requiresReview: true,
    });

    // ============================================ APP 3: Factory Licence (DRAFT)
    const factoryId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profileId,
      ruleId: "MH-FP-002",
      approvalTitle: "Factory Licence (Factories Act, 1948)",
      authority: "Directorate of Industrial Safety and Health (DISH), Maharashtra",
      department: "Industries & Commerce",
      status: "DRAFT",
      slaWorkingDays: 15,
      pauseIntervals: [],
      applicantWaitMs: 0,
    } as never);
    await appEvent(factoryId, { eventType: "APPLICATION_CREATED", actorName: "Demo Applicant", actorId: applicant._id, to: "DRAFT", detail: "Created draft", at: workingDaysAgo(3) });

    // ============================================ APP 4: CTO (DRAFT, blocked by CTE)
    const ctoId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profileId,
      ruleId: "MH-FP-004",
      approvalTitle: "Consent to Operate (CTO)",
      authority: "Maharashtra Pollution Control Board (MPCB)",
      department: "Maharashtra Pollution Control Board",
      status: "DRAFT",
      slaWorkingDays: 20,
      pauseIntervals: [],
      applicantWaitMs: 0,
    } as never);
    await appEvent(ctoId, { eventType: "APPLICATION_CREATED", actorName: "Demo Applicant", actorId: applicant._id, to: "DRAFT", detail: "Created draft — blocked by CTE prerequisite", at: workingDaysAgo(2) });

    // ============================================ APP 5: FSSAI (APPROVED, compliance)
    const fssaiId = await ctx.db.insert("applications", {
      organizationId: orgId,
      businessProfileId: profileId,
      ruleId: "MH-FP-005",
      approvalTitle: "FSSAI Food Business Licence",
      authority: "FSSAI",
      department: "FSSAI",
      status: "APPROVED",
      slaWorkingDays: 20,
      submittedAt: workingDaysAgo(60),
      governmentRefId: "MH-GATE-FSSAI-9034",
      pauseIntervals: [],
      applicantWaitMs: 0,
      decisionAt: workingDaysAgo(50),
      decisionBy: supervisor._id,
      lastSlaStatus: "ON_TRACK",
    } as never);
    await appEvent(fssaiId, { eventType: "APPLICATION_CREATED", actorName: "Demo Applicant", actorId: applicant._id, to: "DRAFT", detail: "Created draft", at: workingDaysAgo(62) });
    await appEvent(fssaiId, { eventType: "APPLICATION_SUBMITTED", actorName: "Demo Applicant", actorId: applicant._id, from: "READY_FOR_SUBMISSION", to: "SUBMITTED", detail: "Reference MH-GATE-FSSAI-9034", at: workingDaysAgo(60) });
    await appEvent(fssaiId, { eventType: "APPLICATION_APPROVED", actorName: "Demo Supervisor", actorId: supervisor._id, from: "DECISION_PENDING", to: "APPROVED", detail: "Approved by department", at: workingDaysAgo(50) });
    await doc({
      applicationId: fssaiId, documentType: "fssai_form",
      fileName: "fssai-licence.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "FSSAI-21524121000000", issueDate: now - 240 * DAY, expiryDate: futureWorking(1500),
      verified: true, confirmed: true,
    });
    await doc({
      applicationId: fssaiId, documentType: "water_test_report",
      fileName: "water-test-report.pdf", businessName: "GreenHarvest Foods Pvt. Ltd.",
      documentNumber: "WTR-PUNE-4501", issueDate: workingDaysAgo(30),
      verified: false, confirmed: true,
    });
    const fssaiRule = await activeRule("MH-FP-005");
    if (fssaiRule) {
      await generateComplianceForApprovedApp(ctx, fssaiId as never, fssaiRule, workingDaysAgo(50));
    }
    await ctx.db.insert("governmentSubmissions", {
      applicationId: fssaiId,
      governmentRefId: "MH-GATE-FSSAI-9034",
      gatewayMode: "MOCK",
      status: "APPROVED",
      submittedAt: workingDaysAgo(60),
      lastSyncAt: workingDaysAgo(50),
      rawResponse: "MOCK_GATEWAY: approved",
      isSimulation: true,
    } as never);

    // ======================================================== notifications
    await ctx.db.insert("notifications", {
      userId: applicant._id,
      title: "SLA at risk",
      message: "Consent to Establish is at risk of breaching its configured 30-working-day processing period.",
      type: "SLA",
      read: false,
      link: "/applicant/applications/" + cteId,
    } as never);
    await ctx.db.insert("notifications", {
      userId: applicant._id,
      title: "Inspection required",
      message: "The department has marked a site inspection as required for Consent to Establish.",
      type: "INSPECTION",
      read: false,
      link: "/applicant/applications/" + cteId,
    } as never);
    await ctx.db.insert("notifications", {
      userId: applicant._id,
      title: "Document requires review",
      message: "Water consent application: extracted fields need your confirmation.",
      type: "DOCUMENT",
      read: false,
      link: "/applicant/documents",
    } as never);
    await ctx.db.insert("notifications", {
      userId: officer._id,
      title: "SLA at risk",
      message: "Consent to Establish (MH-GATE-CTE-2214) is at risk of breaching its SLA.",
      type: "SLA",
      read: false,
      link: "/department/applications/" + cteId,
    } as never);

    // ============================================================= audit
    await recordAudit(ctx, {
      actorId: applicant._id,
      actorName: "Demo Applicant",
      actorRole: "applicant",
      action: "LOGIN",
      entityType: "users",
      entityId: applicant._id,
      detail: "Demo login (password)",
      occurredAt: now - 2 * DAY,
    });
    await recordAudit(ctx, {
      actorId: officer._id,
      actorName: "Demo Officer",
      actorRole: "dept_officer",
      action: "DEPARTMENT_ACCESS",
      entityType: "applications",
      entityId: cteId,
      detail: "Accessed application MH-GATE-CTE-2214 (department compartment: MPCB)",
      occurredAt: now - 1 * DAY,
    });
    await recordAudit(ctx, {
      actorId: admin._id,
      actorName: "Demo Administrator",
      actorRole: "admin",
      action: "DEMO_SEEDED",
      entityType: "system",
      detail: "Verification pipeline: curated sources → candidate rules → human review → ACTIVE.",
    });

    // =============================================================== flag
    await ctx.db.insert("settings", { key: "demo_seeded", value: now } as never);

    void profile;
    void seq;
    return {
      organizationId: orgId as Id<"organizations">,
      businessProfileId: profileId,
      applicationIds: { udyamId, cteId, factoryId, ctoId, fssaiId },
      rules: DEMO_RULES.length,
      schemes: DEMO_SCHEMES.length,
    };
  },
});

function sha(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pad = (n: number) => n.toString(16).padStart(16, "0");
  return `${pad(h)}${pad(h ^ 0x9e3779b9)}${pad(h ^ 0x85ebca6b)}${pad(h ^ 0xc2b2ae35)}`;
}