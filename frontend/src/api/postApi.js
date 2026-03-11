import axiosClient from './axiosClient';

export const postApi = {
  getHistory: () => axiosClient.get('/api/history').then(r => r.data),
  getHistoryById: (id) => axiosClient.get(`/api/history/${id}`).then(r => r.data),
};
