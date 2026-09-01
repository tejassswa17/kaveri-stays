import { apiClient } from './client';
import type { ReviewRequest, ReviewResponse } from '../types';

export const createReview = async (
  bookingId: number,
  data: ReviewRequest
): Promise<ReviewResponse> => {
  const response = await apiClient.post<ReviewResponse>(
    `/bookings/${bookingId}/review`,
    data
  );
  return response.data;
};
