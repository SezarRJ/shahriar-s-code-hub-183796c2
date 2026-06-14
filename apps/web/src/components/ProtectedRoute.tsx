import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  // BYPASS AUTH FOR DEMO
  return <Outlet />;
}

