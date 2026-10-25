import axios from 'axios';

// Base axios instance — all requests go to the backend
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hcm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth expiry globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/change-password');
    if (error.response?.status === 401 && !isAuthCall) {
      // Token expired or invalid — force logout
      localStorage.removeItem('hcm_token');
      localStorage.removeItem('hcm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
