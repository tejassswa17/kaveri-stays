export interface PaymentRequest {
  amount: string;
  method: string;
}

export interface PaymentResponse {
  payment_id: number;
  booking_id: number;
  amount: string;
  method: string;
  created_at: string;
}

export interface PaymentListResponse {
  items: PaymentResponse[];
  total_paid: string;
  balance: string;
}
