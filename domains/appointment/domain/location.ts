export interface AppointmentLocation {
  id: string;
  name: string;
  type: string;
  facilityId: string | null;
  isActive: boolean;
}

export interface CreateLocationInput {
  name: string;
  type: string;
  facilityId?: string;
}

export const LOCATION_TYPES = {
  EXAM_ROOM: "exam_room",
  LAB: "lab",
  WAITING: "waiting",
  CONSULTATION: "consultation",
} as const;

export type LocationType = (typeof LOCATION_TYPES)[keyof typeof LOCATION_TYPES];
