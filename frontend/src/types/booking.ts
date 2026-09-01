import type { PageMeta } from './api';

export type BookingStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface BookingRequest {
  room_id: number;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  guests: number;
  guest_id?: number | null;
  deposit?: string | null;
}

export interface BookingResponse {
  booking_id: number;
  guest_id: number;
  room_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  total_amount: string | null;
}

export interface BookingOut {
  booking_id: number;
  guest_id: number;
  room_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: BookingStatus;
  total_amount: string | null;
}

export interface BookingPage {
  items: BookingOut[];
  meta: PageMeta;
}
