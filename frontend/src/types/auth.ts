export type UserRole = 'guest' | 'staff' | 'manager' | 'owner';

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  account_id: number;
  guest_id: number;
  email: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface LogoutResponse {
  message: string;
}

export interface AuthMeResponse {
  account_id: number;
  role: string;
}

export interface MeOut {
  account_id: number;
  role: UserRole;
  email: string | null;
  full_name: string | null;
  property_id: number | null;
}
