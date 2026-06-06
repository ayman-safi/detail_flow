import type { Booking, Stage, StaffMember } from '@/types';

export const stageSequence: Stage[] = ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready', 'Delivered'];
export const boardBaseStageSequence: Stage[] = ['Booked', 'Arrived', 'Washing', 'Detailing', 'Polishing', 'Ready'];

export const vehicleTypes = ['Sedan', 'SUV', 'Truck', 'Van', 'Motorcycle', 'Other'] as const;

export function getStageKey(stage: Stage) {
  return `stages.${stage}` as const;
}

export function getBookingStatusKey(status: Booking['status']) {
  return `bookingStatuses.${status}` as const;
}

export function getRoleKey(role: StaffMember['role']) {
  return `roles.${role}` as const;
}

export function getVehicleTypeKey(type: (typeof vehicleTypes)[number]) {
  return `vehicleTypes.${type}` as const;
}
