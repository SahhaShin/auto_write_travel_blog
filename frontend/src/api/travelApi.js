import axiosClient from './axiosClient';

const travelApi = {
  // Trip
  getTrips: () => axiosClient.get('/api/travel').then(r => r.data),
  createTrip: (data) => axiosClient.post('/api/travel', data).then(r => r.data),
  getTrip: (id) => axiosClient.get(`/api/travel/${id}`).then(r => r.data),
  updateTrip: (id, data) => axiosClient.put(`/api/travel/${id}`, data).then(r => r.data),
  deleteTrip: (id) => axiosClient.delete(`/api/travel/${id}`).then(r => r.data),

  // AI 생성
  generatePlan: (tripId) => axiosClient.post(`/api/travel/${tripId}/generate`).then(r => r.data),
  fillGaps: (tripId) => axiosClient.post(`/api/travel/${tripId}/fill-gaps`).then(r => r.data),
  completePlan: (tripId, existingPlan) =>
    axiosClient.post(`/api/travel/${tripId}/complete`, { existingPlan }).then(r => r.data),

  // Itinerary
  addItinerary: (tripId, data) =>
    axiosClient.post(`/api/travel/${tripId}/itinerary`, data).then(r => r.data),
  updateItinerary: (tripId, itemId, data) =>
    axiosClient.put(`/api/travel/${tripId}/itinerary/${itemId}`, data).then(r => r.data),
  deleteItinerary: (tripId, itemId) =>
    axiosClient.delete(`/api/travel/${tripId}/itinerary/${itemId}`).then(r => r.data),

  // Checklist
  addChecklist: (tripId, data) =>
    axiosClient.post(`/api/travel/${tripId}/checklist`, data).then(r => r.data),
  updateChecklistStatus: (tripId, itemId, status) =>
    axiosClient.put(`/api/travel/${tripId}/checklist/${itemId}/status`, { status }).then(r => r.data),
  updateChecklistItem: (tripId, itemId, data) =>
    axiosClient.put(`/api/travel/${tripId}/checklist/${itemId}`, data).then(r => r.data),
  deleteChecklist: (tripId, itemId) =>
    axiosClient.delete(`/api/travel/${tripId}/checklist/${itemId}`).then(r => r.data),

  // Expenses
  addExpense: (tripId, data) =>
    axiosClient.post(`/api/travel/${tripId}/expenses`, data).then(r => r.data),
  updateExpense: (tripId, expenseId, data) =>
    axiosClient.put(`/api/travel/${tripId}/expenses/${expenseId}`, data).then(r => r.data),
  deleteExpense: (tripId, expenseId) =>
    axiosClient.delete(`/api/travel/${tripId}/expenses/${expenseId}`).then(r => r.data),

  // 각종 정보
  updateInfo: (tripId, infoContent) =>
    axiosClient.put(`/api/travel/${tripId}/info`, { infoContent }).then(r => r.data),
};

export default travelApi;
