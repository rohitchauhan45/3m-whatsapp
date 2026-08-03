import { apiClient, getApiErrorMessage } from '@/lib/api/client';

export interface Site {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteAssignedUser {
  id: string;
  userId: string;
  name: string;
  number: string;
  assignedAt: string;
}

export interface SiteDetail extends Site {
  addedby: {
    id: string;
    name: string;
    number: string;
  };
  users: SiteAssignedUser[];
}

export interface AssignableSiteUser {
  id: string;
  name: string;
  number: string;
}

export interface SitesListResponse {
  success: boolean;
  status: number;
  message: string;
  data?: Site[];
}

export interface GeocodeResponse {
  success: boolean;
  status: number;
  message: string;
  data?: { address: string };
  error?: string;
}

export interface CreateSitePayload {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CreateSiteResponse {
  success: boolean;
  status: number;
  message: string;
  data?: Site;
  error?: string;
}

export interface SiteDetailResponse {
  success: boolean;
  status: number;
  message: string;
  data?: SiteDetail;
  error?: string;
}

export interface AssignableUsersResponse {
  success: boolean;
  status: number;
  message: string;
  data?: AssignableSiteUser[];
  error?: string;
}

export interface AssignSiteUsersResponse {
  success: boolean;
  status: number;
  message: string;
  data?: { assignedCount: number };
  error?: string;
}

export async function fetchSites(): Promise<SitesListResponse> {
  const { data } = await apiClient.get<SitesListResponse>('/site');
  return data;
}

export async function geocodeSiteLocation(
  latitude: number,
  longitude: number,
): Promise<GeocodeResponse> {
  const { data } = await apiClient.get<GeocodeResponse>('/site/geocode', {
    params: { latitude, longitude },
  });
  return data;
}

export async function createSite(payload: CreateSitePayload): Promise<CreateSiteResponse> {
  const { data } = await apiClient.post<CreateSiteResponse>('/site', payload);
  return data;
}

export async function fetchSiteById(siteId: string): Promise<SiteDetailResponse> {
  const { data } = await apiClient.get<SiteDetailResponse>(`/site/${siteId}`);
  return data;
}

export async function fetchAssignableSiteUsers(siteId: string): Promise<AssignableUsersResponse> {
  const { data } = await apiClient.get<AssignableUsersResponse>(
    `/site/${siteId}/assignable-users`,
  );
  return data;
}

export async function assignUsersToSite(
  siteId: string,
  userIds: string[],
): Promise<AssignSiteUsersResponse> {
  const { data } = await apiClient.post<AssignSiteUsersResponse>(`/site/${siteId}/users`, {
    userIds,
  });
  return data;
}

export function formatSiteApiError(error: unknown, fallback = 'Something went wrong'): string {
  return getApiErrorMessage(error, fallback);
}
