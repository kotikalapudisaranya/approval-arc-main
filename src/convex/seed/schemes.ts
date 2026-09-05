// ---------------------------------------------------------------------------
// CURATED DEMO SCHEME DATA — published criteria only, with explicit source /
// provenance fields. The matcher is deterministic; final eligibility is
// decided by the scheme authority, never by this prototype.
// ---------------------------------------------------------------------------

export type DemoScheme = {
  schemeId: string;
  name: string;
  authority: string;
  sector: string;
  state: string;
  eligibilityCriteria: string[];
  benefits: string[];
  applicationMethod: string;
  openingDate?: number;
  closingDate?: number;
  officialSource: string;
  status: "ACTIVE" | "CLOSING_SOON" | "UPCOMING" | "CLOSED" | "SUSPENDED" | "HISTORICAL";
  maxInvestmentLakh?: number;
  minInvestmentLakh?: number;
  maxEmployees?: number;
  minEmployees?: number;
  projectTypesAllowed: string[];
  matchCriteria: { field: string; op: string; value: string | number | boolean | null }[];
};

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

export const DEMO_SCHEMES: DemoScheme[] = [
  {
    schemeId: "SCH-PM-FME-01",
    name: "PM Formalisation of Micro Food Processing Enterprises (PM-FME)",
    authority: "Ministry of Food Processing Industries (MoFPI)",
    sector: "Food Processing",
    state: "All India",
    eligibilityCriteria: [
      "Existing or new micro/small food processing enterprises",
      "Sector: Food Processing",
      "Project cost up to ₹5 crore for manufacturing units",
    ],
    benefits: [
      "Credit-linked capital subsidy (up to 35%)",
      "Grant for common infrastructure",
      "Seed capital for SHGs / FPOs",
    ],
    applicationMethod: "Apply through state nodal agency portal",
    openingDate: now - 60 * DAY,
    closingDate: now + 90 * DAY,
    officialSource: "mofpi.gov.in / pmfme.mofpi.gov.in (prototype source record)",
    status: "ACTIVE",
    maxInvestmentLakh: 500,
    minInvestmentLakh: 0,
    projectTypesAllowed: ["New Manufacturing Unit", "Expansion", "Modernisation"],
    matchCriteria: [
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "investment", op: "lte", value: 500 },
    ],
  },
  {
    schemeId: "SCH-MH-IP-02",
    name: "Maharashtra State Industrial Policy — Incentive Package",
    authority: "Directorate of Industries, Govt. of Maharashtra",
    sector: "All (priority sectors incl. Food Processing)",
    state: "Maharashtra",
    eligibilityCriteria: [
      "New industrial unit in Maharashtra",
      "Investment ₹1 crore or more",
      "Admissibility as per policy package",
    ],
    benefits: [
      "Stamp duty exemption / partial reimbursement",
      "Electricity duty exemption",
      "Net SGST reimbursement (as per policy)",
    ],
    applicationMethod: "Apply on MAITRI portal",
    openingDate: now - 30 * DAY,
    closingDate: now + 12 * DAY,
    officialSource: "maitri.maharashtra.gov.in (prototype source record)",
    status: "CLOSING_SOON",
    maxInvestmentLakh: undefined,
    minInvestmentLakh: 100,
    projectTypesAllowed: ["New Manufacturing Unit"],
    matchCriteria: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "investment", op: "gte", value: 100 },
      { field: "projectType", op: "eq", value: "New Manufacturing Unit" },
    ],
  },
  {
    schemeId: "SCH-MH-FPM-03",
    name: "Maharashtra Food Processing Mission — Capital Subsidy",
    authority: "MoFPI / Govt. of Maharashtra",
    sector: "Food Processing",
    state: "Maharashtra",
    eligibilityCriteria: [
      "Food processing unit in Maharashtra",
      "Sector: Food Processing",
      "Beneficiaries: individuals, firms, companies",
    ],
    benefits: [
      "Capital subsidy on plant & machinery",
      "Interest subvention on term loans",
    ],
    applicationMethod: "Apply through MoFPI online portal",
    openingDate: now + 20 * DAY,
    closingDate: now + 110 * DAY,
    officialSource: "mofpi.gov.in (prototype source record)",
    status: "UPCOMING",
    projectTypesAllowed: ["New Manufacturing Unit", "Expansion"],
    matchCriteria: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "sector", op: "eq", value: "Food Processing" },
    ],
  },
  {
    schemeId: "SCH-PMEGP-04",
    name: "PM Employment Generation Programme (PMEGP)",
    authority: "KVIC / State KVIB, Ministry of MSME",
    sector: "All manufacturing & service",
    state: "All India",
    eligibilityCriteria: [
      "New micro enterprises only",
      "Project cost up to ₹50 lakh (manufacturing)",
      "Existing units not eligible",
    ],
    benefits: [
      "Margin money subsidy (15%–35%)",
      "Term finance from banks",
    ],
    applicationMethod: "Apply through KVIC / KVIB online portal",
    openingDate: now - 90 * DAY,
    closingDate: now - 10 * DAY,
    officialSource: "kvic.gov.in (prototype source record)",
    status: "CLOSED",
    maxInvestmentLakh: 50,
    minInvestmentLakh: 0,
    projectTypesAllowed: ["New Manufacturing Unit"],
    matchCriteria: [
      { field: "investment", op: "lte", value: 50 },
      { field: "projectType", op: "eq", value: "New Manufacturing Unit" },
    ],
  },
  {
    schemeId: "SCH-PUNE-FPI-05",
    name: "Pune Cluster Food Processing Infrastructure Grant",
    authority: "MoFPI — Mega Food Park / Cluster scheme",
    sector: "Food Processing",
    state: "Maharashtra",
    eligibilityCriteria: [
      "Unit located within Pune district",
      "Food processing activity",
      "Plant in commissioning stage",
    ],
    benefits: [
      "Grant for processing infrastructure",
      "Common facility access",
    ],
    applicationMethod: "Apply through cluster SPV",
    openingDate: now - 45 * DAY,
    closingDate: now + 30 * DAY,
    officialSource: "mofpi.gov.in (prototype source record)",
    status: "ACTIVE",
    projectTypesAllowed: ["New Manufacturing Unit"],
    matchCriteria: [
      { field: "state", op: "eq", value: "Maharashtra" },
      { field: "district", op: "eq", value: "Pune" },
      { field: "sector", op: "eq", value: "Food Processing" },
      { field: "projectStage", op: "eq", value: "Commissioning" },
    ],
  },
  {
    schemeId: "SCH-TEX-06",
    name: "National Textiles Scheme (Technical Textiles Mission)",
    authority: "Ministry of Textiles",
    sector: "Textiles",
    state: "All India",
    eligibilityCriteria: [
      "Textiles / technical textiles sector",
      "Manufacturing units",
    ],
    benefits: ["Capital subsidy on machinery"],
    applicationMethod: "Apply through Ministry of Textiles portal",
    openingDate: now - 30 * DAY,
    closingDate: now + 60 * DAY,
    officialSource: "texmin.gov.in (prototype source record)",
    status: "ACTIVE",
    projectTypesAllowed: ["New Manufacturing Unit", "Expansion"],
    matchCriteria: [{ field: "sector", op: "eq", value: "Textiles" }],
  },
];