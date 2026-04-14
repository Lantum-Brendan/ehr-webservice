import { type IAppointmentRepository } from "@domains/appointment/domain/appointmentRepository.js";
import { Appointment } from "@domains/appointment/domain/appointmentEntity.js";
import { type IEncounterRepository } from "@domains/encounter/domain/encounterRepository.js";
import { Encounter } from "@domains/encounter/domain/encounterEntity.js";
import { type IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { Patient } from "@domains/patient/domain/patientEntity.js";
import { BadRequestError, NotFoundError } from "@core/errors/appError.js";
import { config } from "@core/config/index.js";
import {
  type FhirBundle,
  type FhirOperationOutcome,
  type FhirResource,
} from "../domain/fhirTypes.js";

interface PatientSearchInput {
  _id?: string;
  identifier?: string;
  family?: string;
  given?: string;
}

interface AppointmentSearchInput {
  _id?: string;
  patient?: string;
  actor?: string;
}

interface EncounterSearchInput {
  _id?: string;
  patient?: string;
  appointment?: string;
  practitioner?: string;
}

type FhirPatientResource = {
  resourceType: "Patient";
  id: string;
  identifier: Array<{
    use: "usual";
    system: string;
    value: string;
  }>;
  active: true;
  name: Array<{
    use: "official";
    family: string;
    given: string[];
  }>;
  birthDate: string;
};

type FhirAppointmentResource = {
  resourceType: "Appointment";
  id: string;
  status: string;
  appointmentType: {
    text: string;
  };
  start: string;
  end: string;
  participant: Array<{
    actor: { reference: string };
    status: string;
  }>;
  created: string;
  description?: string;
  comment?: string;
  cancellationReason?: {
    text: string;
  };
};

type FhirEncounterResource = {
  resourceType: "Encounter";
  id: string;
  status: string;
  class: {
    system: string;
    code: string;
    display: string;
  };
  subject: {
    reference: string;
  };
  appointment?: Array<{
    reference: string;
  }>;
  participant?: Array<{
    individual: {
      reference: string;
    };
  }>;
  type: Array<{
    text: string;
  }>;
  period: {
    start: string;
    end?: string;
  };
};

function normalizeBaseUrl(): string {
  return (config.fhir.baseUrl ?? "/api/v1/fhir").replace(/\/$/, "");
}

function buildBundle<TResource extends FhirResource>(
  resources: TResource[],
  baseUrl: string,
): FhirBundle<TResource> {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource) => ({
      fullUrl: `${baseUrl}/${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function mapAppointmentStatus(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "booked";
    case "CONFIRMED":
      return "fulfilled";
    case "CHECKED_IN":
      return "checked-in";
    case "IN_PROGRESS":
      return "arrived";
    case "COMPLETED":
      return "fulfilled";
    case "CANCELLED_BY_PATIENT":
    case "CANCELLED_BY_STAFF":
      return "cancelled";
    case "NO_SHOW":
      return "noshow";
    default:
      return "proposed";
  }
}

function mapEncounterStatus(status: string): string {
  switch (status) {
    case "planned":
      return "planned";
    case "arrived":
      return "arrived";
    case "in-progress":
      return "in-progress";
    case "completed":
      return "finished";
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}

function mapEncounterClass(encounterType: string) {
  switch (encounterType) {
    case "outpatient":
      return {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory",
      };
    case "inpatient":
      return {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "IMP",
        display: "inpatient encounter",
      };
    case "emergency":
      return {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "EMER",
        display: "emergency",
      };
    case "telehealth":
    case "virtual":
      return {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "VR",
        display: "virtual",
      };
    default:
      return {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: encounterType,
      };
  }
}

function toFhirPatient(patient: Patient, baseUrl: string): FhirPatientResource {
  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: [
      {
        use: "usual",
        system: `${baseUrl}/identifier/mrn`,
        value: patient.mrn,
      },
    ],
    active: true,
    name: [
      {
        use: "official",
        family: patient.lastNameValue,
        given: [patient.firstNameValue],
      },
    ],
    birthDate: patient.dateOfBirthValue.toISOString().split("T")[0],
  };
}

function toFhirAppointment(
  appointment: Appointment,
): FhirAppointmentResource {
  const resource: FhirAppointmentResource = {
    resourceType: "Appointment",
    id: appointment.id,
    status: mapAppointmentStatus(appointment.status),
    appointmentType: {
      text: appointment.appointmentTypeId,
    },
    start: appointment.scheduledStart.toISOString(),
    end: appointment.scheduledEnd.toISOString(),
    participant: [
      {
        actor: { reference: `Patient/${appointment.patientId}` },
        status: "accepted",
      },
      {
        actor: { reference: `Practitioner/${appointment.providerId}` },
        status: "accepted",
      },
    ],
    created: appointment.createdAt.toISOString(),
  };

  if (appointment.reason) {
    resource.description = appointment.reason;
  }

  if (appointment.notes) {
    resource.comment = appointment.notes;
  }

  if (appointment.cancelledReason) {
    resource.cancellationReason = {
      text: appointment.cancelledReason,
    };
  }

  return resource;
}

function toFhirEncounter(encounter: Encounter): FhirEncounterResource {
  const resource: FhirEncounterResource = {
    resourceType: "Encounter",
    id: encounter.id,
    status: mapEncounterStatus(encounter.statusValue),
    class: mapEncounterClass(encounter.encounterTypeValue),
    subject: {
      reference: `Patient/${encounter.patientId}`,
    },
    type: [
      {
        text: encounter.encounterTypeValue,
      },
    ],
    period: {
      start: encounter.startTimeValue.toISOString(),
    },
  };

  if (encounter.endTimeValue) {
    resource.period.end = encounter.endTimeValue.toISOString();
  }

  if (encounter.appointmentId) {
    resource.appointment = [
      {
        reference: `Appointment/${encounter.appointmentId}`,
      },
    ];
  }

  if (encounter.providerId) {
    resource.participant = [
      {
        individual: {
          reference: `Practitioner/${encounter.providerId}`,
        },
      },
    ];
  }

  return resource;
}

export function toOperationOutcome(
  diagnostics: string,
  code: string = "processing",
): FhirOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "error",
        code,
        diagnostics,
      },
    ],
  };
}

export class FhirGatewayService {
  private readonly baseUrl = normalizeBaseUrl();

  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly encounterRepo: IEncounterRepository,
  ) {}

  getCapabilityStatement() {
    return {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      software: {
        name: "EHR Webservice FHIR Gateway",
      },
      fhirVersion: "4.0.1",
      format: ["application/fhir+json", "json"],
      rest: [
        {
          mode: "server",
          resource: [
            {
              type: "Patient",
              interaction: [{ code: "read" }, { code: "search-type" }],
              searchParam: [
                { name: "_id", type: "token" },
                { name: "identifier", type: "token" },
                { name: "family", type: "string" },
                { name: "given", type: "string" },
              ],
            },
            {
              type: "Appointment",
              interaction: [{ code: "read" }, { code: "search-type" }],
              searchParam: [
                { name: "_id", type: "token" },
                { name: "patient", type: "reference" },
                { name: "actor", type: "reference" },
              ],
            },
            {
              type: "Encounter",
              interaction: [{ code: "read" }, { code: "search-type" }],
              searchParam: [
                { name: "_id", type: "token" },
                { name: "patient", type: "reference" },
                { name: "appointment", type: "reference" },
                { name: "practitioner", type: "reference" },
              ],
            },
          ],
        },
      ],
    };
  }

  async readPatient(id: string): Promise<FhirPatientResource> {
    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      throw new NotFoundError(`Patient ${id} not found`);
    }

    return toFhirPatient(patient, this.baseUrl);
  }

  async searchPatients(
    input: PatientSearchInput,
  ): Promise<FhirBundle<FhirPatientResource>> {
    if (!input._id && !input.identifier && !input.family && !input.given) {
      throw new BadRequestError(
        "At least one Patient search parameter is required",
      );
    }

    const patients = await this.patientRepo.findAll();
    const filtered = patients.filter((patient) => {
      if (input._id && patient.id !== input._id) {
        return false;
      }

      if (
        input.identifier &&
        patient.mrn.toLowerCase() !== input.identifier.toLowerCase()
      ) {
        return false;
      }

      if (
        input.family &&
        !patient.lastNameValue
          .toLowerCase()
          .includes(input.family.toLowerCase())
      ) {
        return false;
      }

      if (
        input.given &&
        !patient.firstNameValue.toLowerCase().includes(input.given.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    return buildBundle(
      filtered.map((patient) => toFhirPatient(patient, this.baseUrl)),
      this.baseUrl,
    );
  }

  async readAppointment(id: string): Promise<FhirAppointmentResource> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(`Appointment ${id} not found`);
    }

    return toFhirAppointment(appointment);
  }

  async searchAppointments(
    input: AppointmentSearchInput,
  ): Promise<FhirBundle<FhirAppointmentResource>> {
    if (!input._id && !input.patient && !input.actor) {
      throw new BadRequestError(
        "At least one Appointment search parameter is required",
      );
    }

    if (input._id) {
      const appointment = await this.appointmentRepo.findById(input._id);
      return buildBundle(
        appointment ? [toFhirAppointment(appointment)] : [],
        this.baseUrl,
      );
    }

    let appointments: Appointment[] = [];

    if (input.patient) {
      appointments = await this.appointmentRepo.findByPatientId(input.patient);
    }

    if (input.actor) {
      const byProvider = await this.appointmentRepo.findByProviderId(input.actor);
      appointments = appointments.length
        ? appointments.filter((item) =>
            byProvider.some((candidate) => candidate.id === item.id),
          )
        : byProvider;
    }

    return buildBundle(
      dedupeById(appointments).map(toFhirAppointment),
      this.baseUrl,
    );
  }

  async readEncounter(id: string): Promise<FhirEncounterResource> {
    const encounter = await this.encounterRepo.findById(id);
    if (!encounter) {
      throw new NotFoundError(`Encounter ${id} not found`);
    }

    return toFhirEncounter(encounter);
  }

  async searchEncounters(
    input: EncounterSearchInput,
  ): Promise<FhirBundle<FhirEncounterResource>> {
    if (!input._id && !input.patient && !input.appointment && !input.practitioner) {
      throw new BadRequestError(
        "At least one Encounter search parameter is required",
      );
    }

    if (input._id) {
      const encounter = await this.encounterRepo.findById(input._id);
      return buildBundle(
        encounter ? [toFhirEncounter(encounter)] : [],
        this.baseUrl,
      );
    }

    let encounters: Encounter[] = [];

    if (input.patient) {
      encounters = await this.encounterRepo.findByPatientId(input.patient);
    }

    if (input.practitioner) {
      const byProvider = await this.encounterRepo.findByProviderId(
        input.practitioner,
      );
      encounters = encounters.length
        ? encounters.filter((item) =>
            byProvider.some((candidate) => candidate.id === item.id),
          )
        : byProvider;
    }

    if (input.appointment) {
      const byAppointment = await this.encounterRepo.findByAppointmentId(
        input.appointment,
      );
      const appointmentMatches = byAppointment ? [byAppointment] : [];
      encounters = encounters.length
        ? encounters.filter((item) =>
            appointmentMatches.some((candidate) => candidate.id === item.id),
          )
        : appointmentMatches;
    }

    return buildBundle(
      dedupeById(encounters).map(toFhirEncounter),
      this.baseUrl,
    );
  }
}
