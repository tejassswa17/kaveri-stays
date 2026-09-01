import { apiClient } from './client';
import type { ReportPage } from '../types';

export const getOccupancyReport = async (
  from: string, // YYYY-MM-DD
  to: string, // YYYY-MM-DD
  propertyId?: number
): Promise<ReportPage> => {
  const response = await apiClient.get<ReportPage>('/reports/occupancy', {
    params: {
      from,
      to,
      ...(propertyId ? { property_id: propertyId } : {}),
    },
  });
  return response.data;
};

export const getAdrReport = async (
  from: string,
  to: string,
  propertyId?: number
): Promise<ReportPage> => {
  const response = await apiClient.get<ReportPage>('/reports/adr', {
    params: {
      from,
      to,
      ...(propertyId ? { property_id: propertyId } : {}),
    },
  });
  return response.data;
};

export const getRevparReport = async (
  from: string,
  to: string,
  propertyId?: number
): Promise<ReportPage> => {
  const response = await apiClient.get<ReportPage>('/reports/revpar', {
    params: {
      from,
      to,
      ...(propertyId ? { property_id: propertyId } : {}),
    },
  });
  return response.data;
};
