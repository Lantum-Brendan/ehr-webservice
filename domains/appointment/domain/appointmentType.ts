export interface AppointmentType {
  id: string;
  name: string;
  defaultDurationMinutes: number;
  color: string | null;
  isActive: boolean;
}

export interface CreateAppointmentTypeInput {
  name: string;
  defaultDurationMinutes?: number;
  color?: string;
}

export interface AppointmentTypeWithDefault extends AppointmentType {
  defaultDurationMinutes: number;
}
