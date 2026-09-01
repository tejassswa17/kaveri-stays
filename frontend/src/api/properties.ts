import { apiClient } from './client';
import type {
  AvailabilityResponse,
  PropertyOut,
  PropertyPage,
  RoomPage,
} from '../types';

export const getProperties = async (
  limit: number = 20,
  offset: number = 0
): Promise<PropertyPage> => {
  const response = await apiClient.get<PropertyPage>('/properties', {
    params: { limit, offset },
  });
  return response.data;
};

export const getProperty = async (propertyId: number): Promise<PropertyOut> => {
  const response = await apiClient.get<PropertyOut>(`/properties/${propertyId}`);
  return response.data;
};

export const getRooms = async (
  propertyId: number,
  limit: number = 20,
  offset: number = 0
): Promise<RoomPage> => {
  const response = await apiClient.get<RoomPage>(`/properties/${propertyId}/rooms`, {
    params: { limit, offset },
  });
  return response.data;
};

export const getAvailability = async (
  propertyId: number,
  checkIn: string,
  checkOut: string,
  roomType?: string
): Promise<AvailabilityResponse> => {
  const response = await apiClient.get<AvailabilityResponse>(
    `/properties/${propertyId}/availability`,
    {
      params: {
        from: checkIn,
        to: checkOut,
        ...(roomType ? { room_type: roomType } : {}),
      },
    }
  );
  return response.data;
};
