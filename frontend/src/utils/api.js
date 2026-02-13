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
    if (error.response?.status === 401) {
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
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  sendChangePasswordCode: () => api.post('/auth/send-code'),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
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
  viewAlbum: (albumId) => api.get(`/admin/albums/${albumId}/detail`),
  downloadPhoto: (albumId, photoId) => api.get(`/admin/albums/${albumId}/photos/${photoId}/download`),
};

export default api;
