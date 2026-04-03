/**
 * Basic FHIR R4 resource types and common interfaces
 * This is a simplified subset - for full FHIR support, use fhir.js or HL7 FHIR TypeScript definitions
 */

export type FHIRResourceType =
  | "Patient"
  | "Practitioner"
  | "Organization"
  | "Encounter"
  | "Condition"
  | "Observation"
  | "MedicationRequest"
  | "Procedure"
  | "DiagnosticReport"
  | "DocumentReference"
  | "AllergyIntolerance"
  | "Immunization"
  | "CarePlan"
  | "Goal"
  | "ServiceRequest"
  | "Claim"
  | "ExplanationOfBenefit"
  | "Coverage"
  | "RelatedPerson"
  | "Device"
  | "Location"
  | "EpisodeOfCare";

export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

export interface FHIRCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRIdentifier {
  use?: "usual" | "official" | "temp" | "secondary" | "old";
  type?: FHIRCodeableConcept;
  system?: string;
  value?: string;
  period?: { start: string; end?: string };
  assigner?: { reference: string; display?: string };
}

export interface FHIRReference {
  reference: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRPeriod {
  start: string;
  end?: string;
}

// Minimal Patient resource representation
export interface FHIRPatient {
  resourceType: "Patient";
  id?: string;
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  address?: FHIRAddress[];
  contact?: FHIRPatientContact[];
  meta?: FHIRMeta;
  extension?: any[];
}

export interface FHIRHumanName {
  use?:
    | "usual"
    | "official"
    | "temp"
    | "nickname"
    | "anonymous"
    | "old"
    | "maiden";
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FHIRContactPoint {
  system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: "home" | "work" | "temp" | "old" | "mobile";
}

export interface FHIRAddress {
  use?: "home" | "work" | "temp" | "old";
  type?: "postal" | "physical" | "both";
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRPatientContact {
  relationship?: FHIRCodeableConcept[];
  name?: FHIRHumanName;
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  gender?: string;
  organization?: FHIRReference;
  period?: FHIRPeriod;
}

// Encounter resource
export interface FHIREncounter {
  resourceType: "Encounter";
  id?: string;
  identifier?: FHIRIdentifier[];
  status:
    | "planned"
    | "in-progress"
    | "onhold"
    | "discharged"
    | "cancelled"
    | "completed"
    | "entered-in-error";
  class?: FHIRCoding;
  type?: FHIRCodeableConcept[];
  subject?: FHIRReference;
  participant?: FHIREncounterParticipant[];
  period?: FHIRPeriod;
  location?: FHIREncounterLocation[];
  serviceProvider?: FHIRReference;
}

export interface FHIREncounterParticipant {
  type?: FHIRCodeableConcept[];
  period?: FHIRPeriod;
  individual?: FHIRReference;
}

export interface FHIREncounterLocation {
  location?: FHIRReference;
  period?: FHIRPeriod;
}

// Observation resource
export interface FHIRObservation {
  resourceType: "Observation";
  id?: string;
  identifier?: FHIRIdentifier[];
  status:
    | "registered"
    | "preliminary"
    | "final"
    | "amended"
    | "corrected"
    | "cancelled"
    | "entered-in-error"
    | "unknown";
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FHIRReference[];
  valueQuantity?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueBoolean?: boolean;
  valueDateTime?: string;
  note?: { text: string }[];
}

// Common response structure for FHIR resources
export interface FHIRBundle {
  resourceType: "Bundle";
  id?: string;
  type:
    | "document"
    | "message"
    | "transaction"
    | "transaction-response"
    | "batch"
    | "batch-response"
    | "history"
    | "searchset"
    | "collection";
  total?: number;
  link?: { relation: string; url: string }[];
  entry?: {
    fullUrl?: string;
    resource?: any;
    search?: { mode: "match" | "include" | "outcome"; score?: number };
  }[];
}
