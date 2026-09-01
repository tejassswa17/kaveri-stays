import { apiClient } from './client';
import type { GuestOut, GuestPage } from '../types';

export const getGuests = async (
  email?: string,
  limit: number = 20,
  offset: number = 0
): Promise<GuestPage> => {
  const response = await apiClient.get<GuestPage>('/guests', {
    params: {
      ...(email ? { email } : {}),
      limit,
      offset,
    },
  });
  return response.data;
};

export const getGuest = async (guestId: number): Promise<GuestOut> => {
  const response = await apiClient.get<GuestOut>(`/guests/${guestId}`);
  return response.data;
};
