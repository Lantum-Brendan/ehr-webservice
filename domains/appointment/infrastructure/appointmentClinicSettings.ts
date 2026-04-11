import { prisma } from "@infrastructure/database/prisma.client.js";

const DEFAULT_CLINIC_SETTINGS = {
  cancellationCutoffHours: 24,
  appointmentBufferMinutes: 0,
} as const;

const SETTINGS_CACHE_TTL_MS = 60_000;

let cachedSettings:
  | {
      value: typeof DEFAULT_CLINIC_SETTINGS;
      expiresAt: number;
    }
  | null = null;

export async function getAppointmentClinicSettings(): Promise<
  typeof DEFAULT_CLINIC_SETTINGS
> {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.value;
  }

  const settings = await prisma.clinicSettings.findFirst({
    select: {
      cancellationCutoffHours: true,
      appointmentBufferMinutes: true,
    },
  });

  const value = {
    cancellationCutoffHours:
      settings?.cancellationCutoffHours ??
      DEFAULT_CLINIC_SETTINGS.cancellationCutoffHours,
    appointmentBufferMinutes:
      settings?.appointmentBufferMinutes ??
      DEFAULT_CLINIC_SETTINGS.appointmentBufferMinutes,
  } as const;

  cachedSettings = {
    value,
    expiresAt: now + SETTINGS_CACHE_TTL_MS,
  };

  return value;
}

export function resetAppointmentClinicSettingsCache(): void {
  cachedSettings = null;
}
