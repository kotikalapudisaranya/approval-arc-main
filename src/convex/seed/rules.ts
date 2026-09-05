// ---------------------------------------------------------------------------
// CURATED VERIFIED DEMO RULE DATA — Maharashtra / Pune / Food Processing only.
//
// This is the only jurisdiction+sector combo with verified, reviewed rules in
// the prototype. Other combos deliberately return "no verified regulatory
// rules configured". Nothing here is fabricated law: these are clearly
// labelled demo/prototype records with explicit provenance fields, and the
// government authority always remains the final decision-maker.
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

/** Common provenance for all seeded demo rules. */
const provenance = (ruleId: string, version = 1) => ({
  jurisdiction: "Maharashtra (Prototype)",
  publicationDate: now - 120 * DAY,
  effectiveDate: now - 90 * DAY,
  version,
  reviewer: "Demo Reviewer — SIH 2026 (prototype data)",
  lastVerified: now - 15 * DAY,
  changeHistory: [
    {
      at: now - 120 * DAY,
      actor: "System Administrator",
      note: "Candidate rule ingested from curated prototype dataset.",
    },
    {
      at: now - 90 * DAY,
      actor: "Demo Reviewer — SIH 2026",
      note: `Rule ${ruleId} reviewed and marked ACTIVE (prototype).`,
    },
  ],
});

export type DemoRule = {
  ruleId: string;
  title: string;
  state: string;
  districtScope?: string;
  sector: string;
  activity: string;
  approvalType: string;
  projectConditions: string[];
  conditions: { field: string; op: "eq" | "ne" | "gte" | "lte" | "in" | "contains"; value: string | number | boolean | null }[];
  requiredInformation: string[];
  requiredDocuments: string[];
  prerequisites: string[];
  dependencies: string[];
  parallelizable: boolean;
  slaWorkingDays: number;
  validityDays: number;
  renewalRules: string;
  officialAuthority: string;
  officialSource: string;
  postApprovalObligations: {
    type: "RENEWAL" | "PERIODIC_FILING" | "INSPECTION" | "CERTIFICATE_UPDATE" | "PERIODIC_REPORT";
    title: string;
    description: string;
    frequencyMonths?: number;
    dueOffsetDays?: number;
  }[];
};

export const DEMO_RULES: DemoRule[] = [
  {
    ruleId: "MH-FP-001",
    title: "Udyam / MSME Business Registration",
    state: "Maharashtra",
    sector: "Food Processing",
    activity: "New Manufacturing Unit",
    approvalType: "REGISTRATION",
    projectConditions: ["NEW_MANUFACTURING_UNIT", "FOOD_PROCESSING"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "projectType", op: "eq", value: "New Manufacturing Unit" },
    ],
    requiredInformation: [
      "Business name and constitution",
      "PAN of business / proprietor",
      "Address of unit",
      "Investment (plant & machinery)",
      "Employee count",
    ],
    requiredDocuments: ["udyam", "pan", "address_proof"],
    prerequisites: [],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 7,
    validityDays: 36500,
    renewalRules: "No renewal required. Update profile if business details change.",
    officialAuthority: "Directorate of Industries, Govt. of Maharashtra",
    officialSource: "udyamregistration.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "PERIODIC_REPORT",
        title: "MSME Udyam profile annual update",
        description: "Confirm business profile details annually to keep the registration current.",
        frequencyMonths: 12,
        dueOffsetDays: 365,
      },
    ],
  },
  {
    ruleId: "MH-FP-002",
    title: "Factory Licence (Factories Act, 1948)",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Manufacturing operation with 20+ workers",
    approvalType: "LICENCE",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "employeeCount", op: "gte", value: 20 },
    ],
    requiredInformation: [
      "Factory layout plan",
      "Manufacturing process description",
      "Number of workers",
      "Power load in HP",
    ],
    requiredDocuments: ["udyam", "factory_plan", "fire_noc", "electrical_cert"],
    prerequisites: ["MH-FP-001"],
    dependencies: ["MH-FP-007", "MH-FP-009"],
    parallelizable: false,
    slaWorkingDays: 15,
    validityDays: 3650,
    renewalRules: "Renew licence before expiry; typically renewed annually/periodically as per state rules.",
    officialAuthority: "Directorate of Industrial Safety and Health (DISH), Maharashtra",
    officialSource: "dish.maharashtra.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "RENEWAL",
        title: "Factory Licence renewal",
        description: "Renew factory licence before expiry.",
        frequencyMonths: 12,
        dueOffsetDays: 340,
      },
      {
        type: "PERIODIC_FILING",
        title: "Half-yearly workers return",
        description: "File half-yearly return of workers with DISH.",
        frequencyMonths: 6,
        dueOffsetDays: 180,
      },
    ],
  },
  {
    ruleId: "MH-FP-003",
    title: "Consent to Establish (CTE)",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Establishment of pollution-causing industrial unit",
    approvalType: "CONSENT",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "investment", op: "gte", value: 100 },
      { field: "projectType", op: "eq", value: "New Manufacturing Unit" },
    ],
    requiredInformation: [
      "Process description and raw materials",
      "Water usage and effluent details",
      "Air emissions details",
      "Site plan",
    ],
    requiredDocuments: ["udyam", "factory_plan", "site_plan", "water_consent_form"],
    prerequisites: ["MH-FP-001", "MH-FP-002"],
    dependencies: ["MH-FP-004"],
    parallelizable: false,
    slaWorkingDays: 30,
    validityDays: 3650,
    renewalRules: "CTE is a one-time consent; CTO must be obtained before operation.",
    officialAuthority: "Maharashtra Pollution Control Board (MPCB)",
    officialSource: "mpcb.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "CERTIFICATE_UPDATE",
        title: "Consent to Operate (CTO) before commissioning",
        description: "Obtain Consent to Operate before commencing operations.",
        dueOffsetDays: 180,
      },
    ],
  },
  {
    ruleId: "MH-FP-004",
    title: "Consent to Operate (CTO)",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Operation of industrial unit",
    approvalType: "CONSENT",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "investment", op: "gte", value: 100 },
    ],
    requiredInformation: [
      "Copy of CTE",
      "Effluent treatment plan",
      "Air pollution control equipment details",
    ],
    requiredDocuments: ["cte_cert", "effluent_plan", "air_control_plan"],
    prerequisites: ["MH-FP-003"],
    dependencies: ["MH-FP-011"],
    parallelizable: false,
    slaWorkingDays: 20,
    validityDays: 3650,
    renewalRules: "CTO renewed periodically; annual consent fees as applicable.",
    officialAuthority: "Maharashtra Pollution Control Board (MPCB)",
    officialSource: "mpcb.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "PERIODIC_FILING",
        title: "Environmental Statement filing",
        description: "Submit annual environmental statement to MPCB.",
        frequencyMonths: 12,
        dueOffsetDays: 365,
      },
      {
        type: "RENEWAL",
        title: "Consent to Operate renewal",
        description: "Renew CTO before expiry.",
        frequencyMonths: 12,
        dueOffsetDays: 330,
      },
    ],
  },
  {
    ruleId: "MH-FP-005",
    title: "FSSAI Food Business Licence",
    state: "Maharashtra",
    sector: "Food Processing",
    activity: "Food business operation / processing",
    approvalType: "LICENCE",
    projectConditions: ["FOOD_PROCESSING"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
    ],
    requiredInformation: [
      "Food business category",
      "Product list",
      "Premises details",
      "Water test report",
    ],
    requiredDocuments: ["udyam", "fssai_form", "water_test_report", "premises_photo"],
    prerequisites: ["MH-FP-001"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 20,
    validityDays: 3650,
    renewalRules: "FSSAI licence renewed before expiry, typically every 1–5 years.",
    officialAuthority: "Food Safety and Standards Authority of India (FSSAI)",
    officialSource: "fssai.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "RENEWAL",
        title: "FSSAI licence renewal",
        description: "Renew food business licence before expiry.",
        frequencyMonths: 60,
        dueOffsetDays: 1780,
      },
      {
        type: "PERIODIC_FILING",
        title: "Annual return (Form D1)",
        description: "File annual returns with the licensing authority.",
        frequencyMonths: 12,
        dueOffsetDays: 365,
      },
    ],
  },
  {
    ruleId: "MH-FP-006",
    title: "Trade Licence (Pune Municipal Corporation)",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Trade / industrial activity within municipal limits",
    approvalType: "LICENCE",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "district", op: "eq", value: "Pune" },
      { field: "sector", op: "in", value: "Food Processing, Manufacturing" },
    ],
    requiredInformation: [
      "Proof of premises",
      "Nature of trade",
      "Sanctioned building plans",
    ],
    requiredDocuments: ["udyam", "address_proof", "building_plan"],
    prerequisites: ["MH-FP-001"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 10,
    validityDays: 3650,
    renewalRules: "Renewed annually by the municipal corporation.",
    officialAuthority: "Pune Municipal Corporation (PMC)",
    officialSource: "pmc.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "RENEWAL",
        title: "Trade licence renewal",
        description: "Renew trade licence with PMC.",
        frequencyMonths: 12,
        dueOffsetDays: 340,
      },
    ],
  },
  {
    ruleId: "MH-FP-007",
    title: "Fire NOC",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Occupancy / operation of industrial premises",
    approvalType: "NOC",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "employeeCount", op: "gte", value: 20 },
    ],
    requiredInformation: [
      "Building layout",
      "Fire safety equipment details",
      "Occupancy load",
    ],
    requiredDocuments: ["building_plan", "fire_system_layout"],
    prerequisites: ["MH-FP-002"],
    dependencies: ["MH-FP-008"],
    parallelizable: false,
    slaWorkingDays: 15,
    validityDays: 3650,
    renewalRules: "Renewed annually; re-inspection may be required.",
    officialAuthority: "Directorate of Maharashtra Fire Services",
    officialSource: "mahafireservice.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "RENEWAL",
        title: "Fire NOC renewal",
        description: "Renew Fire NOC with annual re-inspection.",
        frequencyMonths: 12,
        dueOffsetDays: 340,
      },
    ],
  },
  {
    ruleId: "MH-FP-008",
    title: "Building Permission / Plan Approval",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Construction / alteration of industrial building",
    approvalType: "PERMISSION",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "district", op: "eq", value: "Pune" },
      { field: "projectType", op: "eq", value: "New Manufacturing Unit" },
    ],
    requiredInformation: [
      "Sanctioned drawings",
      "Ownership / lease documents",
      "Structural stability certificate",
    ],
    requiredDocuments: ["land_document", "building_plan", "structural_cert"],
    prerequisites: [],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 30,
    validityDays: 1825,
    renewalRules: "Building permission valid for construction period; extension if needed.",
    officialAuthority: "Pune Municipal Corporation / PCMC Building Permission Cell",
    officialSource: "pmc.gov.in (prototype source record)",
    postApprovalObligations: [],
  },
  {
    ruleId: "MH-FP-009",
    title: "Electrical Installation Safety Certificate",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Industrial electrical installation",
    approvalType: "CERTIFICATE",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "employeeCount", op: "gte", value: 20 },
    ],
    requiredInformation: [
      "Electrical layout",
      "Connected load details",
      "Safety earthing details",
    ],
    requiredDocuments: ["electrical_layout", "load_details"],
    prerequisites: ["MH-FP-002"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 10,
    validityDays: 1825,
    renewalRules: "Certificate renewed on re-inspection or major load changes.",
    officialAuthority: "Chief Electrical Inspector, Maharashtra",
    officialSource: "mahadiscom.in / CEIG Maharashtra (prototype source record)",
    postApprovalObligations: [
      {
        type: "INSPECTION",
        title: "Periodic electrical safety inspection",
        description: "Arrange periodic electrical safety inspection.",
        frequencyMonths: 24,
        dueOffsetDays: 730,
      },
    ],
  },
  {
    ruleId: "MH-FP-011",
    title: "Legal Metrology Registration (Packaged Commodities)",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Manufacture / packing of packaged commodities",
    approvalType: "REGISTRATION",
    projectConditions: ["FOOD_PROCESSING", "PACKAGED_GOODS"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "condition:Packaged Goods Sales", op: "eq", value: true },
    ],
    requiredInformation: [
      "Details of packaged products",
      "Packaging unit details",
      "Batch/size declarations",
    ],
    requiredDocuments: ["udyam", "packaging_details"],
    prerequisites: ["MH-FP-005"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 10,
    validityDays: 3650,
    renewalRules: "Registration valid until cancelled; renew on changes.",
    officialAuthority: "Legal Metrology Department, Govt. of Maharashtra",
    officialSource: "mahametrology.gov.in (prototype source record)",
    postApprovalObligations: [],
  },
  {
    ruleId: "MH-FP-010",
    title: "Boiler Registration",
    state: "Maharashtra",
    sector: "Food Processing",
    activity: "Operation of steam boiler",
    approvalType: "REGISTRATION",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "condition:Steam Boiler Installed", op: "eq", value: true },
    ],
    requiredInformation: [
      "Boiler make / capacity",
      "Safety valves details",
      "Boiler room layout",
    ],
    requiredDocuments: ["boiler_cert", "boiler_layout"],
    prerequisites: ["MH-FP-002"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 15,
    validityDays: 3650,
    renewalRules: "Periodic boiler inspection certificate required (typically annually).",
    officialAuthority: "Boiler Inspection Department (BID), Maharashtra",
    officialSource: "boiler.maharashtra.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "INSPECTION",
        title: "Annual boiler inspection",
        description: "Arrange annual boiler inspection by BID.",
        frequencyMonths: 12,
        dueOffsetDays: 365,
      },
    ],
  },
  {
    ruleId: "MH-FP-012",
    title: "Hazardous Waste Authorisation",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Generation / handling of hazardous waste",
    approvalType: "AUTHORISATION",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "condition:Hazardous Waste Generated", op: "eq", value: true },
    ],
    requiredInformation: [
      "Waste types and quantities",
      "Waste storage details",
      "Disposal route",
    ],
    requiredDocuments: ["hazardous_waste_form", "waste_storage_plan"],
    prerequisites: ["MH-FP-003"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 20,
    validityDays: 3650,
    renewalRules: "Renewed with consent; annual returns as applicable.",
    officialAuthority: "Maharashtra Pollution Control Board (MPCB)",
    officialSource: "mpcb.gov.in (prototype source record)",
    postApprovalObligations: [
      {
        type: "PERIODIC_FILING",
        title: "Hazardous waste annual return",
        description: "File annual return on hazardous waste generation.",
        frequencyMonths: 12,
        dueOffsetDays: 365,
      },
    ],
  },
  {
    ruleId: "MH-FP-013",
    title: "Groundwater Abstraction Permission",
    state: "Maharashtra",
    districtScope: "Pune",
    sector: "Food Processing",
    activity: "Industrial groundwater abstraction",
    approvalType: "PERMISSION",
    projectConditions: ["NEW_MANUFACTURING_UNIT"],
    conditions: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "condition:Groundwater Extraction", op: "eq", value: true },
    ],
    requiredInformation: [
      "Borewell location and depth",
      "Extraction rate",
      "Recharge plan",
    ],
    requiredDocuments: ["borewell_details", "water_consent_form"],
    prerequisites: ["MH-FP-003"],
    dependencies: [],
    parallelizable: true,
    slaWorkingDays: 20,
    validityDays: 3650,
    renewalRules: "Permission renewed as per state groundwater authority.",
    officialAuthority: "Groundwater Surveys & Development Agency (GSDA), Maharashtra",
    officialSource: "gsda.maharashtra.gov.in (prototype source record)",
    postApprovalObligations: [],
  },
];

export function toRuleDoc() {
  return DEMO_RULES.map((r) => ({
    ...r,
    ...provenance(r.ruleId, 1),
    verificationStatus: "ACTIVE" as const,
  }));
}