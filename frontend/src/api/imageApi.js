import axiosClient from './axiosClient';

export const imageApi = {
  upload: (files, draftId) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (draftId) formData.append('draftId', draftId);
    return axiosClient.post('/api/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  getByDraft: (draftId) => axiosClient.get(`/api/images/draft/${draftId}`).then(r => r.data),
  updateOrder: (id, displayOrder) => axiosClient.put(`/api/images/${id}/order`, { displayOrder }),
  delete: (id) => axiosClient.delete(`/api/images/${id}`),
};
