import axiosClient from './axiosClient';

export const styleApi = {
  getAll: () => axiosClient.get('/api/styles').then(r => r.data),
  addFromText: (data) => axiosClient.post('/api/styles', data).then(r => r.data),
  addFromUrl: (url, category) => axiosClient.post('/api/styles/from-url', { url, category }).then(r => r.data),
  delete: (id) => axiosClient.delete(`/api/styles/${id}`),
};
