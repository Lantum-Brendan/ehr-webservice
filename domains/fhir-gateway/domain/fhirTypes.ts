export interface FhirResource {
  resourceType: string;
  id?: string;
}

export interface FhirBundleEntry<TResource extends FhirResource = FhirResource> {
  fullUrl: string;
  resource: TResource;
}

export interface FhirBundle<TResource extends FhirResource = FhirResource> {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  entry: FhirBundleEntry<TResource>[];
}

export interface FhirOperationOutcomeIssue {
  severity: "fatal" | "error" | "warning" | "information";
  code: string;
  diagnostics: string;
}

export interface FhirOperationOutcome {
  resourceType: "OperationOutcome";
  issue: FhirOperationOutcomeIssue[];
}
