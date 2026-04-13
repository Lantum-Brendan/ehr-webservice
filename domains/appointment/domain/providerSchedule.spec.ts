import { describe, expect, it } from "vitest";

import { ProviderSchedule } from "./providerSchedule.js";

function makeLocalDate(hours = 0, minutes = 0) {
  return new Date(2099, 5, 15, hours, minutes, 0, 0);
}

describe("ProviderSchedule", () => {
  it("rejects times that are not in strict HH:mm format", () => {
    expect(() =>
      ProviderSchedule.create({
        providerId: "provider-1",
        dayOfWeek: 1,
        startTime: "9:00",
        endTime: "17:00",
      }),
    ).toThrow("Start time must be in HH:mm format (00:00-23:59)");

    expect(() =>
      ProviderSchedule.create({
        providerId: "provider-1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17",
      }),
    ).toThrow("End time must be in HH:mm format (00:00-23:59)");
  });

  it("detects whether an interval fits inside the schedule window", () => {
    const schedule = ProviderSchedule.create({
      providerId: "provider-1",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "12:00",
    });

    expect(
      schedule.coversInterval(
        makeLocalDate(9, 30),
        makeLocalDate(11, 0),
      ),
    ).toBe(true);

    expect(
      schedule.coversInterval(
        makeLocalDate(11, 30),
        makeLocalDate(12, 30),
      ),
    ).toBe(false);
  });
});
