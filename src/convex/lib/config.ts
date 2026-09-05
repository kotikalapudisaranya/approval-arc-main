// Shared configuration for business-profile selectors and document metadata.
// Kept in src/convex so the backend and the frontend both use the same source
// of truth. STILL: only Maharashtra + Food Processing has verified rules.
export const STATES = ["Maharashtra", "Telangana", "Karnataka"] as const;

export const DISTRICTS: Record<string, string[]> = {
  Maharashtra: ["Pune", "Mumbai", "Nashik", "Nagpur", "Aurangabad"],
  Telangana: ["Hyderabad", "Ranga Reddy", "Medchal"],
  Karnataka: ["Bengaluru Urban", "Mysuru", "Belagavi"],
};

export const SECTORS = [
  "Food Processing",
  "Manufacturing",
  "Pharmaceuticals",
  "Textiles",
  "Electronics",
  "Chemicals",
] as const;

export const BUSINESS_TYPES = ["Private Limited Company", "LLP", "Partnership Firm", "Proprietorship"];

export const PROJECT_TYPES = [
  "New Manufacturing Unit",
  "Expansion",
  "Modernisation",
  "Diversification",
  "Ancillary Unit",
] as const;

export const PROJECT_STAGES = [
  "Concept / Planning",
  "Land Acquisition",
  "Construction",
  "Commissioning",
  "Operational",
] as const;

export const OPERATIONAL_CONDITIONS = [
  "Packaged Goods Sales",
  "Steam Boiler Installed",
  "Groundwater Extraction",
  "Hazardous Waste Generated",
  "Exports (>50%)",
  "Cold Chain Operations",
] as const;

/** Label map for rule document requirement keys. */
export const DOCUMENT_TYPES: Record<string, string> = {
  udyam: "Udyam / MSME Registration",
  pan: "PAN Card",
  address_proof: "Address Proof",
  factory_plan: "Factory Layout Plan",
  fire_noc: "Fire NOC",
  electrical_cert: "Electrical Safety Certificate",
  site_plan: "Site Plan",
  water_consent_form: "Water Consent Application",
  cte_cert: "Consent to Establish Certificate",
  effluent_plan: "Effluent Treatment Plan",
  air_control_plan: "Air Pollution Control Plan",
  fssai_form: "FSSAI Application / Licence",
  water_test_report: "Water Test Report",
  premises_photo: "Premises Photograph",
  building_plan: "Building Plan",
  land_document: "Land / Lease Document",
  structural_cert: "Structural Stability Certificate",
  electrical_layout: "Electrical Layout",
  load_details: "Connected Load Details",
  packaging_details: "Packaging Details",
  boiler_cert: "Boiler Certificate",
  boiler_layout: "Boiler Room Layout",
  hazardous_waste_form: "Hazardous Waste Application",
  waste_storage_plan: "Waste Storage Plan",
  borewell_details: "Borewell Details",
  other: "Other",
};

export const DOC_FIELD_LABELS: Record<string, string> = {
  businessName: "Business Name",
  documentNumber: "Document / Certificate Number",
  registrationNumber: "Registration Number",
  issueDate: "Issue Date",
  expiryDate: "Expiry Date",
  authority: "Issuing Authority",
  certificateType: "Certificate Type",
  address: "Registered Address",
  qrCode: "QR Code",
  siteAddress: "Site Address",
  planType: "Plan Type",
  applicantName: "Applicant Name",
  applicationNumber: "Application Number",
  licenceNumber: "Licence Number",
  preparedBy: "Prepared By",
  testDate: "Test Date",
  testResult: "Test Result",
  equipmentDetails: "Equipment Details",
  loadDetails: "Load Details",
  wasteType: "Waste Type",
  quantity: "Quantity",
  premisesDescription: "Premises Description",
  packagingDetails: "Packaging Details",
};

export type DocumentFieldKey = keyof typeof DOC_FIELD_LABELS;

export const DOCUMENT_FIELD_PROFILES: Record<string, DocumentFieldKey[]> = {
  udyam: ["businessName", "documentNumber", "issueDate", "address", "authority"],
  pan: ["businessName", "documentNumber", "qrCode"],
  address_proof: ["businessName", "address", "documentNumber", "issueDate"],
  factory_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate"],
  fire_noc: ["businessName", "documentNumber", "issueDate", "expiryDate", "authority", "address"],
  electrical_cert: ["businessName", "documentNumber", "issueDate", "expiryDate", "authority", "address"],
  site_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate"],
  water_consent_form: ["businessName", "applicationNumber", "siteAddress", "authority", "issueDate"],
  cte_cert: ["businessName", "documentNumber", "issueDate", "expiryDate", "authority", "address"],
  effluent_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate", "equipmentDetails"],
  air_control_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate", "equipmentDetails"],
  fssai_form: ["businessName", "licenceNumber", "issueDate", "expiryDate", "address", "authority"],
  water_test_report: ["businessName", "testDate", "testResult", "authority", "siteAddress"],
  premises_photo: ["businessName", "siteAddress", "issueDate"],
  building_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate"],
  land_document: ["businessName", "address", "documentNumber", "issueDate"],
  structural_cert: ["businessName", "documentNumber", "issueDate", "expiryDate", "preparedBy", "address"],
  electrical_layout: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate", "loadDetails"],
  load_details: ["businessName", "siteAddress", "loadDetails", "preparedBy", "issueDate"],
  packaging_details: ["businessName", "packagingDetails", "issueDate"],
  boiler_cert: ["businessName", "documentNumber", "issueDate", "expiryDate", "authority", "equipmentDetails"],
  boiler_layout: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate", "equipmentDetails"],
  hazardous_waste_form: ["businessName", "applicationNumber", "wasteType", "quantity", "siteAddress", "issueDate"],
  waste_storage_plan: ["businessName", "siteAddress", "planType", "preparedBy", "issueDate", "wasteType"],
  borewell_details: ["businessName", "siteAddress", "quantity", "issueDate", "authority"],
  other: ["businessName", "documentNumber", "certificateType", "issueDate", "expiryDate", "authority", "address"],
};

export const DOCUMENT_TYPE_MARKERS: Record<string, string[]> = {
  udyam: ["udyam", "msme"],
  pan: ["income tax", "permanent account number", "pan"],
  address_proof: ["address", "aadhaar", "aadhar", "electricity bill", "utility bill"],
  factory_plan: ["factory", "layout", "plan"],
  fire_noc: ["fire", "no objection", "noc"],
  electrical_cert: ["electrical", "safety", "inspector"],
  site_plan: ["site plan", "site layout"],
  water_consent_form: ["water", "consent", "application"],
  cte_cert: ["consent to establish", "cte", "pollution"],
  effluent_plan: ["effluent", "treatment plant"],
  air_control_plan: ["air pollution", "air control"],
  fssai_form: ["fssai", "food safety", "food licence"],
  water_test_report: ["water test", "laboratory", "ph", "sample"],
  building_plan: ["building plan", "building drawing"],
  land_document: ["lease", "land", "rent agreement", "sale deed"],
  structural_cert: ["structural", "stability certificate"],
  electrical_layout: ["electrical layout", "single line diagram"],
  load_details: ["connected load", "load details"],
  boiler_cert: ["boiler", "steam"],
  boiler_layout: ["boiler layout", "boiler room"],
  hazardous_waste_form: ["hazardous waste", "waste application"],
  waste_storage_plan: ["waste storage", "storage plan"],
  borewell_details: ["borewell", "bore well", "groundwater"],
};

/** Normalize a string for deterministic comparisons. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}