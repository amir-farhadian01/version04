import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { lazy, Suspense, type ReactNode } from 'react'

import { AdminLayout } from './components/AdminLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const UserDetail = lazy(() => import('./pages/UserDetail'))
const Kyc = lazy(() => import('./pages/Kyc'))
const Orders = lazy(() => import('./pages/Orders'))
const Contracts = lazy(() => import('./pages/Contracts'))
const Payments = lazy(() => import('./pages/Payments'))
const Media = lazy(() => import('./pages/Media'))
const Settings = lazy(() => import('./pages/Settings'))
const Moderation = lazy(() => import('./pages/Moderation'))
const HomeContent = lazy(() => import('./pages/HomeContent'))
const ContentModeration = lazy(() => import('./pages/ContentModeration'))
const Analytics = lazy(() => import('./pages/Analytics'))
const FormBuilder = lazy(() => import('./pages/FormBuilder'))

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" className="p-8 text-center">Loading...</div>}>{children}</Suspense>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LazyPage><Login /></LazyPage>,
  },
  {
    path: '/',
    element: <RequireAuth><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/admin" replace /> },
      { path: 'admin', element: <LazyPage><Dashboard /></LazyPage> },
      { path: 'admin/users', element: <LazyPage><Users /></LazyPage> },
      { path: 'admin/users/:id', element: <LazyPage><UserDetail /></LazyPage> },
      { path: 'admin/kyc', element: <LazyPage><Kyc /></LazyPage> },
      { path: 'admin/orders', element: <LazyPage><Orders /></LazyPage> },
      { path: 'admin/contracts', element: <LazyPage><Contracts /></LazyPage> },
      { path: 'admin/payments', element: <LazyPage><Payments /></LazyPage> },
      { path: 'admin/media', element: <LazyPage><Media /></LazyPage> },
      { path: 'admin/settings', element: <LazyPage><Settings /></LazyPage> },
      { path: 'admin/moderation', element: <LazyPage><Moderation /></LazyPage> },
      { path: 'admin/home-content', element: <LazyPage><HomeContent /></LazyPage> },
      { path: 'admin/content-moderation', element: <LazyPage><ContentModeration /></LazyPage> },
      { path: 'admin/analytics', element: <LazyPage><Analytics /></LazyPage> },
      { path: 'admin/services/:catalogId/form-builder', element: <LazyPage><FormBuilder /></LazyPage> },
    ],
  },
])
