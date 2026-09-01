import { apiClient } from './client';
import type {
  BookingOut,
  BookingPage,
  BookingRequest,
  BookingResponse,
  BookingStatus,
} from '../types';

export interface BookingQueryParams {
  status?: BookingStatus;
  guest_id?: number;
  property_id?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  sort?: string;
  limit?: number;
  offset?: number;
}

export const getBookings = async (params: BookingQueryParams = {}): Promise<BookingPage> => {
  const response = await apiClient.get<BookingPage>('/bookings', { params });
  return response.data;
};

export const getBooking = async (bookingId: number): Promise<BookingOut> => {
  const response = await apiClient.get<BookingOut>(`/bookings/${bookingId}`);
  return response.data;
};

export const createBooking = async (data: BookingRequest): Promise<BookingResponse> => {
  const response = await apiClient.post<BookingResponse>('/bookings', data);
  return response.data;
};

export const checkInBooking = async (bookingId: number): Promise<BookingResponse> => {
  const response = await apiClient.post<BookingResponse>(`/bookings/${bookingId}/check-in`);
  return response.data;
};

export const checkOutBooking = async (bookingId: number): Promise<BookingResponse> => {
  const response = await apiClient.post<BookingResponse>(`/bookings/${bookingId}/check-out`);
  return response.data;
};

export const cancelBooking = async (bookingId: number): Promise<BookingResponse> => {
  const response = await apiClient.post<BookingResponse>(`/bookings/${bookingId}/cancel`);
  return response.data;
};

export const noShowBooking = async (bookingId: number): Promise<BookingResponse> => {
  const response = await apiClient.post<BookingResponse>(`/bookings/${bookingId}/no-show`);
  return response.data;
};
