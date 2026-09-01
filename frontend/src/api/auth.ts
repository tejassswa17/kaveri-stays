import { apiClient, setTokens, clearTokens } from './client';
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  MeOut,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types';

export const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data);
  return response.data;
};

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  const { access_token, refresh_token } = response.data;
  setTokens(access_token, refresh_token);
  return response.data;
};

export const refreshToken = async (data: RefreshRequest): Promise<RefreshResponse> => {
  const response = await apiClient.post<RefreshResponse>('/auth/refresh', data);
  const { access_token, refresh_token } = response.data;
  setTokens(access_token, refresh_token);
  return response.data;
};

export const logout = async (data: LogoutRequest): Promise<LogoutResponse> => {
  try {
    const response = await apiClient.post<LogoutResponse>('/auth/logout', data);
    return response.data;
  } finally {
    clearTokens();
  }
};

export const getMe = async (): Promise<MeOut> => {
  const response = await apiClient.get<MeOut>('/me');
  return response.data;
};
