export interface ReviewRequest {
  rating: number; // 1 to 5
  comment?: string | null;
}

export interface ReviewResponse {
  review_id: number;
  booking_id: number;
  rating: number;
  comment: string | null;
}
