import axiosClient from './axiosClient';

export const postApi = {
  startPost: (draftId) => axiosClient.post(`/api/post/${draftId}`).then(r => r.data),
  getStatus: (draftId) => axiosClient.get(`/api/post/status/${draftId}`).then(r => r.data),
  saveCredentials: (data) => axiosClient.put('/api/credentials', data).then(r => r.data),
  getHistory: () => axiosClient.get('/api/history').then(r => r.data),
  getHistoryById: (id) => axiosClient.get(`/api/history/${id}`).then(r => r.data),
};
