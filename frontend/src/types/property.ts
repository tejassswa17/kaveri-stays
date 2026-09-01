import type { PageMeta } from './api';

export interface PropertyOut {
  property_id: number;
  name: string;
  city: string;
  star_rating: number;
}

export interface PropertyPage {
  items: PropertyOut[];
  meta: PageMeta;
}

export interface RoomOut {
  room_id: number;
  room_number: string;
  room_type: string;
  max_occupancy: number;
}

export interface RoomPage {
  items: RoomOut[];
  meta: PageMeta;
}

export interface AvailabilityRoom extends RoomOut {
  nightly_rate: string;
  total_rate: string;
}

export interface AvailabilityResponse {
  items: AvailabilityRoom[];
}
