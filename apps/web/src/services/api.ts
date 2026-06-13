import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const fetchProjects = () => api.get('/projects');
export const createProject = (data: any) => api.post('/projects', data);
export const fetchProject = (id: string) => api.get(`/projects/${id}`);
export const fetchReports = (projectId?: string) =>
  api.get('/reports', { params: projectId ? { project_id: projectId } : {} });
export const triggerReport = (data: any) => api.post('/reports/trigger', data);
export const fetchPhotos = (capturePointId?: string) =>
  api.get('/photos', { params: capturePointId ? { capture_point_id: capturePointId } : {} });
export const verifyPhoto = (id: string) => api.get(`/photos/${id}/verify`);
export const exportEvidence = (photoId: string) =>
  api.get('/evidence/export', { params: { photo_id: photoId } });
export const fetchUsers = () => api.get('/users');
export const createUser = (data: any) => api.post('/users', data);
export const loginUser = (email: string, password: string) =>
  api.post('/auth/login', { email, password });
export const fetchNotifications = () => api.get('/notifications');
export const markNotificationRead = (id: string) =>
  api.patch(`/notifications/${id}/read`);
