import type { PageMeta } from './api';

export interface GuestOut {
  guest_id: number;
  full_name: string;
  email: string;
}

export interface GuestPage {
  items: GuestOut[];
  meta: PageMeta;
}
