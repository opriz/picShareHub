import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 对于不需要认证的API（如resend-verification, forgot-password），即使返回401也不应该登出
    const noAuthRequiredPaths = ['/auth/resend-verification', '/auth/forgot-password', '/auth/reset-password', '/auth/register', '/auth/login', '/auth/verify-email'];
    const isNoAuthPath = noAuthRequiredPaths.some(path => error.config?.url?.includes(path));
    
    if (error.response?.status === 401 && !isNoAuthPath) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/s/')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Album APIs
export const albumAPI = {
  create: (data) => api.post('/albums', data),
  getMyAlbums: (page = 1) => api.get(`/albums?page=${page}`),
  getDetail: (id) => api.get(`/albums/${id}`),
  update: (id, data) => api.put(`/albums/${id}`, data),
  delete: (id) => api.delete(`/albums/${id}`),
  getQRCode: (id) => api.get(`/albums/${id}/qrcode`),
  uploadPhotos: (albumId, formData, onProgress) =>
    api.post(`/albums/${albumId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 minutes for uploads
      onUploadProgress: onProgress,
    }),
  deletePhoto: (albumId, photoId) => api.delete(`/albums/${albumId}/photos/${photoId}`),
  getPhotoOriginal: (albumId, photoId) => api.get(`/albums/${albumId}/photos/${photoId}/original`),
};

// Public APIs
export const publicAPI = {
  viewAlbum: (shareCode) => api.get(`/s/${shareCode}`),
  downloadPhoto: (shareCode, photoId) => api.get(`/s/${shareCode}/photos/${photoId}/download`),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (page = 1) => api.get(`/admin/users?page=${page}`),
  getUserAlbums: (userId, page = 1) => api.get(`/admin/users/${userId}/albums?page=${page}`),
  getAllAlbums: (page = 1, status = 'all') => api.get(`/admin/albums?page=${page}&status=${status}`),
  getAlbumLogs: (albumId) => api.get(`/admin/albums/${albumId}/logs`),
};

// Feedback APIs
export const feedbackAPI = {
  submit: (formData) => api.post('/feedback', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 1 minute for feedback submission
  }),
};

export default api;
