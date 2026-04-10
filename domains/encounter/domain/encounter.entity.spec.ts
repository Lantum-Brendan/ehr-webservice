import { describe, it, expect, vi } from "vitest";
import { Encounter } from "./encounterEntity";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "enc-uuid-5678"),
}));

const VALID_INPUT = {
  patientId: "patient-123",
  encounterType: "outpatient",
  startTime: "2026-04-01T10:00:00Z",
};

// ─── Factory Creation ───────────────────────────────────────────

describe("Encounter.create", () => {
  it("creates a valid encounter with all fields", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      endTime: "2026-04-01T11:00:00Z",
      status: "completed",
    });

    expect(encounter.id).toBe("enc-uuid-5678");
    expect(encounter.patientId).toBe("patient-123");
    expect(encounter.encounterTypeValue).toBe("outpatient");
    expect(encounter.statusValue).toBe("completed");
  });

  it("defaults status to planned", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.statusValue).toBe("planned");
  });

  it("defaults endTime to null", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.endTimeValue).toBeNull();
  });

  it("trims encounterType whitespace", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      encounterType: "  outpatient  ",
    });
    expect(encounter.encounterTypeValue).toBe("outpatient");
  });

  it("accepts Date objects for time fields", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      startTime: new Date("2026-04-01T10:00:00Z"),
      endTime: new Date("2026-04-01T11:00:00Z"),
    });
    expect(encounter.encounterTypeValue).toBe("outpatient");
  });

  // ─── Validation ───────────────────────────────────────────────

  it("throws if patientId is empty", () => {
    expect(() => Encounter.create({ ...VALID_INPUT, patientId: "" })).toThrow(
      "Patient ID is required",
    );
  });

  it("throws if encounterType is empty", () => {
    expect(() =>
      Encounter.create({ ...VALID_INPUT, encounterType: "" }),
    ).toThrow("Encounter type is required");
  });

  it("throws if encounterType is whitespace only", () => {
    expect(() =>
      Encounter.create({ ...VALID_INPUT, encounterType: "   " }),
    ).toThrow("Encounter type is required");
  });

  it("throws if startTime is invalid", () => {
    expect(() =>
      Encounter.create({ ...VALID_INPUT, startTime: "not-a-date" }),
    ).toThrow("Start time must be a valid date");
  });

  it("throws if endTime is invalid", () => {
    expect(() =>
      Encounter.create({
        ...VALID_INPUT,
        endTime: "not-a-date",
      }),
    ).toThrow("End time must be a valid date");
  });

  it("throws if endTime is before startTime", () => {
    expect(() =>
      Encounter.create({
        ...VALID_INPUT,
        startTime: "2026-04-01T11:00:00Z",
        endTime: "2026-04-01T10:00:00Z",
      }),
    ).toThrow("End time must be after start time");
  });

  // ─── Valid Encounter Types ────────────────────────────────────

  it.each(["outpatient", "inpatient", "emergency", "telehealth", "virtual"])(
    "accepts valid encounter type: %s",
    (type) => {
      const encounter = Encounter.create({
        ...VALID_INPUT,
        encounterType: type,
      });
      expect(encounter.encounterTypeValue).toBe(type);
    },
  );

  it("rejects invalid encounter type", () => {
    expect(() =>
      Encounter.create({ ...VALID_INPUT, encounterType: "home-visit" }),
    ).toThrow(
      "Encounter type must be one of: outpatient, inpatient, emergency, telehealth, virtual",
    );
  });

  // ─── Valid Statuses ───────────────────────────────────────────

  it.each(["planned", "arrived", "in-progress", "completed", "cancelled"])(
    "accepts valid status: %s",
    (status) => {
      const encounter = Encounter.create({ ...VALID_INPUT, status });
      expect(encounter.statusValue).toBe(status);
    },
  );

  it("rejects invalid status", () => {
    expect(() =>
      Encounter.create({ ...VALID_INPUT, status: "unknown" }),
    ).toThrow(
      "Status must be one of: planned, arrived, in-progress, completed, cancelled",
    );
  });
});

// ─── Getters ──────────────────────────────────────────────────────

describe("Encounter getters", () => {
  it("encounterTypeValue returns the type", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.encounterTypeValue).toBe("outpatient");
  });

  it("startTimeValue returns a new Date instance", () => {
    const encounter = Encounter.create(VALID_INPUT);
    const a = encounter.startTimeValue;
    const b = encounter.startTimeValue;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("endTimeValue returns null when no end time set", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.endTimeValue).toBeNull();
  });

  it("endTimeValue returns Date when set", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      endTime: "2026-04-01T11:00:00Z",
    });
    expect(encounter.endTimeValue).toEqual(new Date("2026-04-01T11:00:00Z"));
  });

  it("statusValue returns a string", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.statusValue).toBe("planned");
  });
});

// ─── durationMinutes ──────────────────────────────────────────────

describe("Encounter.durationMinutes", () => {
  it("returns null when no end time", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.durationMinutes).toBeNull();
  });

  it("calculates duration in minutes", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T11:30:00Z",
    });
    expect(encounter.durationMinutes).toBe(90);
  });

  it("calculates duration for short encounters", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-01T10:15:00Z",
    });
    expect(encounter.durationMinutes).toBe(15);
  });

  it("calculates multi-day encounters", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      startTime: "2026-04-01T10:00:00Z",
      endTime: "2026-04-02T10:00:00Z",
    });
    expect(encounter.durationMinutes).toBe(1440);
  });
});

// ─── updateStatus ─────────────────────────────────────────────────

describe("Encounter.updateStatus", () => {
  it("updates status from planned to arrived", () => {
    const encounter = Encounter.create(VALID_INPUT);
    encounter.updateStatus("arrived");
    expect(encounter.statusValue).toBe("arrived");
  });

  it("updates status from arrived to in-progress", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "arrived" });
    encounter.updateStatus("in-progress");
    expect(encounter.statusValue).toBe("in-progress");
  });

  it("updates status from in-progress to completed", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      status: "in-progress",
    });
    encounter.updateStatus("completed");
    expect(encounter.statusValue).toBe("completed");
  });

  it("updates status from planned to cancelled", () => {
    const encounter = Encounter.create(VALID_INPUT);
    encounter.updateStatus("cancelled");
    expect(encounter.statusValue).toBe("cancelled");
  });

  it("throws for invalid status value", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(() => encounter.updateStatus("discharged")).toThrow(
      "Status must be one of: planned, arrived, in-progress, completed, cancelled",
    );
  });

  it("throws if trying to update a completed encounter", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "completed" });
    expect(() => encounter.updateStatus("cancelled")).toThrow(
      "Cannot update status of completed encounter",
    );
  });

  it("throws if trying to update a cancelled encounter", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "cancelled" });
    expect(() => encounter.updateStatus("planned")).toThrow(
      "Cannot update status of cancelled encounter",
    );
  });
});

// ─── updateTimings ────────────────────────────────────────────────

describe("Encounter.updateTimings", () => {
  it("updates start and end time", () => {
    const encounter = Encounter.create(VALID_INPUT);
    const newStart = new Date("2026-04-02T09:00:00Z");
    const newEnd = new Date("2026-04-02T10:00:00Z");
    encounter.updateTimings(newStart, newEnd);

    expect(encounter.startTimeValue).toEqual(newStart);
    expect(encounter.endTimeValue).toEqual(newEnd);
  });

  it("updates start time with null end time", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      endTime: "2026-04-01T11:00:00Z",
    });
    const newStart = new Date("2026-04-02T09:00:00Z");
    encounter.updateTimings(newStart, null);

    expect(encounter.startTimeValue).toEqual(newStart);
    expect(encounter.endTimeValue).toBeNull();
  });

  it("throws if start time is invalid", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(() => encounter.updateTimings(new Date(NaN), null)).toThrow(
      "Start time must be a valid date",
    );
  });

  it("throws if end time is invalid", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(() =>
      encounter.updateTimings(new Date("2026-04-01T10:00:00Z"), new Date(NaN)),
    ).toThrow("End time must be a valid date or null");
  });

  it("throws if end time is before start time", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(() =>
      encounter.updateTimings(
        new Date("2026-04-01T11:00:00Z"),
        new Date("2026-04-01T10:00:00Z"),
      ),
    ).toThrow("End time must be after start time");
  });

  it("throws if trying to update timings of completed encounter", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "completed" });
    expect(() =>
      encounter.updateTimings(new Date("2026-04-02T09:00:00Z"), null),
    ).toThrow("Cannot update timings of completed encounter");
  });
});

// ─── State Checks ─────────────────────────────────────────────────

describe("Encounter state checks", () => {
  it("isCompleted returns true for completed", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "completed" });
    expect(encounter.isCompleted()).toBe(true);
  });

  it("isCompleted returns false for non-completed", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.isCompleted()).toBe(false);
  });

  it("isCancelled returns true for cancelled", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "cancelled" });
    expect(encounter.isCancelled()).toBe(true);
  });

  it("isCancelled returns false for non-cancelled", () => {
    const encounter = Encounter.create(VALID_INPUT);
    expect(encounter.isCancelled()).toBe(false);
  });

  it("isActive returns true for planned", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "planned" });
    expect(encounter.isActive()).toBe(true);
  });

  it("isActive returns true for arrived", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "arrived" });
    expect(encounter.isActive()).toBe(true);
  });

  it("isActive returns true for in-progress", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      status: "in-progress",
    });
    expect(encounter.isActive()).toBe(true);
  });

  it("isActive returns false for completed", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "completed" });
    expect(encounter.isActive()).toBe(false);
  });

  it("isActive returns false for cancelled", () => {
    const encounter = Encounter.create({ ...VALID_INPUT, status: "cancelled" });
    expect(encounter.isActive()).toBe(false);
  });
});

// ─── toJSON ───────────────────────────────────────────────────────

describe("Encounter.toJSON", () => {
  it("serializes encounter with all properties", () => {
    const encounter = Encounter.create({
      ...VALID_INPUT,
      endTime: "2026-04-01T11:00:00Z",
      status: "completed",
    });

    const json = encounter.toJSON();

    expect(json).toEqual({
      id: "enc-uuid-5678",
      patientId: "patient-123",
      encounterType: "outpatient",
      startTime: "2026-04-01T10:00:00.000Z",
      endTime: "2026-04-01T11:00:00.000Z",
      status: "completed",
      durationMinutes: 60,
    });
  });

  it("serializes with null endTime and null duration", () => {
    const encounter = Encounter.create(VALID_INPUT);
    const json = encounter.toJSON();

    expect(json.endTime).toBeNull();
    expect(json.durationMinutes).toBeNull();
  });
});
