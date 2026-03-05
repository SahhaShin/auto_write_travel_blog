import axiosClient from './axiosClient';

export const generateApi = {
  generate: (draftId, styleSampleIds) =>
    axiosClient.post(`/api/generate/${draftId}`, { styleSampleIds }).then(r => r.data),
  regenerate: (draftId, styleSampleIds, customInstructions) =>
    axiosClient.post(`/api/generate/${draftId}/regenerate`, { styleSampleIds, customInstructions }).then(r => r.data),
};
