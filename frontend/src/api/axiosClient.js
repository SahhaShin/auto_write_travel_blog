import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // Claude API 호출은 최대 2분
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || '오류가 발생했습니다.';
    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
