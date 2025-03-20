
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PublicRoute from '@/components/auth/PublicRoute';
import Profile from '@/pages/Profile';
import ApiConfig from '@/pages/ApiConfig';
import Settings from '@/pages/Settings';
import Sync from '@/pages/Sync';
import Employees from '@/pages/Employees';
import Companies from '@/pages/Companies';

// Placeholder components for the routes that are not yet implemented
const Absenteeism = () => <div className="p-6"><h1 className="text-2xl font-bold">Absenteísmo (Recurso Premium)</h1></div>;
const Indicators = () => <div className="p-6"><h1 className="text-2xl font-bold">Indicadores (Recurso Premium)</h1></div>;
const Help = () => <div className="p-6"><h1 className="text-2xl font-bold">Ajuda</h1></div>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>
  },
  {
    path: '/login',
    element: <PublicRoute><Login /></PublicRoute>
  },
  {
    path: '/register',
    element: <PublicRoute><Register /></PublicRoute>
  },
  {
    path: '/profile',
    element: <ProtectedRoute><Profile /></ProtectedRoute>
  },
  {
    path: '/api-config',
    element: <ProtectedRoute><ApiConfig /></ProtectedRoute>
  },
  {
    path: '/settings',
    element: <ProtectedRoute><Settings /></ProtectedRoute>
  },
  {
    path: '/sync',
    element: <ProtectedRoute><Sync /></ProtectedRoute>
  },
  {
    path: '/employees',
    element: <ProtectedRoute><Employees /></ProtectedRoute>
  },
  {
    path: '/companies',
    element: <ProtectedRoute><Companies /></ProtectedRoute>
  },
  {
    path: '/absenteeism',
    element: <ProtectedRoute><Absenteeism /></ProtectedRoute>
  },
  {
    path: '/indicators',
    element: <ProtectedRoute><Indicators /></ProtectedRoute>
  },
  {
    path: '/help',
    element: <ProtectedRoute><Help /></ProtectedRoute>
  },
  {
    path: '*',
    element: <NotFound />
  }
]);
