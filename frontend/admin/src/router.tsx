import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import type { ReactNode } from 'react'

import { AdminLayout } from './components/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Kyc from './pages/Kyc'
import Orders from './pages/Orders'
import Contracts from './pages/Contracts'
import Payments from './pages/Payments'
import Media from './pages/Media'
import Settings from './pages/Settings'
import Moderation from './pages/Moderation'
import HomeContent from './pages/HomeContent'
import ContentModeration from './pages/ContentModeration'
import Analytics from './pages/Analytics'
import FormBuilder from './pages/FormBuilder'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <RequireAuth><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/admin" replace /> },
      { path: 'admin', element: <Dashboard /> },
      { path: 'admin/users', element: <Users /> },
      { path: 'admin/users/:id', element: <UserDetail /> },
      { path: 'admin/kyc', element: <Kyc /> },
      { path: 'admin/orders', element: <Orders /> },
      { path: 'admin/contracts', element: <Contracts /> },
      { path: 'admin/payments', element: <Payments /> },
      { path: 'admin/media', element: <Media /> },
      { path: 'admin/settings', element: <Settings /> },
      { path: 'admin/moderation', element: <Moderation /> },
      { path: 'admin/home-content', element: <HomeContent /> },
      { path: 'admin/content-moderation', element: <ContentModeration /> },
      { path: 'admin/analytics', element: <Analytics /> },
      { path: 'admin/services/:catalogId/form-builder', element: <FormBuilder /> },
    ],
  },
])
