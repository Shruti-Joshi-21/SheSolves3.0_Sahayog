import api from './api';

export const fetchMapData = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);

  const response = await api.get(`/admin/map-data?${params.toString()}`);
  return response.data.data; // array of map pin objects
};