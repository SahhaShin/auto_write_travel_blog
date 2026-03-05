import axiosClient from './axiosClient';

export const draftApi = {
  getAll: () => axiosClient.get('/api/drafts').then(r => r.data),
  getById: (id) => axiosClient.get(`/api/drafts/${id}`).then(r => r.data),
  create: (data) => axiosClient.post('/api/drafts', data).then(r => r.data),
  update: (id, data) => axiosClient.put(`/api/drafts/${id}`, data).then(r => r.data),
  delete: (id) => axiosClient.delete(`/api/drafts/${id}`),
};
