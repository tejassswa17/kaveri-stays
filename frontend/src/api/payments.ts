import { apiClient } from './client';
import type { PaymentListResponse, PaymentRequest, PaymentResponse } from '../types';

export const generateIdempotencyKey = (): string => {
  return 'idem_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export const getPayments = async (bookingId: number): Promise<PaymentListResponse> => {
  const response = await apiClient.get<PaymentListResponse>(`/bookings/${bookingId}/payments`);
  return response.data;
};

export const recordPayment = async (
  bookingId: number,
  data: PaymentRequest,
  idempotencyKey?: string
): Promise<PaymentResponse> => {
  const key = idempotencyKey || generateIdempotencyKey();
  const response = await apiClient.post<PaymentResponse>(
    `/bookings/${bookingId}/payments`,
    data,
    {
      headers: {
        'Idempotency-Key': key,
      },
    }
  );
  return response.data;
};
