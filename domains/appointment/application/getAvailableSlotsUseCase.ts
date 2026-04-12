import type {
  IProviderScheduleRepository,
  IScheduleBlockRepository,
} from "../domain/scheduleRepository.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

interface TimeSlot {
  start: Date;
  end: Date;
}

export class GetAvailableSlotsUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly appointmentRepo: IAppointmentRepository,
  ) {}

  async execute(
    providerId: string,
    date: Date,
    durationMinutes: number = 30,
  ): Promise<TimeSlot[]> {
    const schedules = await this.scheduleRepo.findByProviderAndDay(
      providerId,
      date.getDay(),
    );

    const daySchedules = schedules.filter((s) => s.isActive);

    if (daySchedules.length === 0) {
      return [];
    }

    const settings = await prisma.clinicSettings.findFirst();
    const bufferMinutes = settings?.appointmentBufferMinutes ?? 0;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const blocks = await this.blockRepo.findByProviderAndDateRange(
      providerId,
      startOfDay,
      endOfDay,
    );

    const activeBlocks = blocks.filter((block) => {
      const blockStart = new Date(block.startDateTime);
      const blockEnd = new Date(block.endDateTime);
      return blockEnd > startOfDay && blockStart < endOfDay;
    });

    const existingAppointments =
      await this.appointmentRepo.findByProviderAndDateRange(
        providerId,
        startOfDay,
        endOfDay,
      );

    const activeAppointments = existingAppointments.filter((apt) => {
      const status = apt.status;
      return (
        status === "SCHEDULED" ||
        status === "CONFIRMED" ||
        status === "CHECKED_IN"
      );
    });

    const allSlots: TimeSlot[] = [];

    for (const schedule of daySchedules) {
      const workingHours = schedule.getWorkingHoursForDate(date);
      if (!workingHours) continue;

      let slotStart = new Date(workingHours.start);

      while (slotStart < workingHours.end) {
        const slotEnd = new Date(
          slotStart.getTime() + durationMinutes * 60 * 1000,
        );

        if (slotEnd > workingHours.end) {
          break;
        }

        const isBlocked = activeBlocks.some((block) =>
          block.overlapsWith(slotStart, slotEnd),
        );

        const hasAppointment = activeAppointments.some((apt) =>
          this.appointmentsOverlap(
            slotStart,
            slotEnd,
            apt.scheduledStart,
            apt.scheduledEnd,
            bufferMinutes,
          ),
        );

        if (!isBlocked && !hasAppointment) {
          allSlots.push({ start: slotStart, end: slotEnd });
        }

        slotStart = new Date(slotEnd.getTime());
      }
    }

    return allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private appointmentsOverlap(
    slotStart: Date,
    slotEnd: Date,
    aptStart: Date,
    aptEnd: Date,
    bufferMinutes: number,
  ): boolean {
    const bufferedSlotStart = new Date(
      slotStart.getTime() - bufferMinutes * 60 * 1000,
    );
    const bufferedSlotEnd = new Date(
      slotEnd.getTime() + bufferMinutes * 60 * 1000,
    );

    return bufferedSlotStart < aptEnd && bufferedSlotEnd > aptStart;
  }
}
