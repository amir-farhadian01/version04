import { createBrowserRouter, Navigate, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { ReactNode } from 'react'

import { PublicLayout } from '../components/layout/PublicLayout'
import { CustomerLayout } from '../components/layout/CustomerLayout'
import { BusinessLayout } from '../components/layout/BusinessLayout'
import { SimpleLayout } from '../components/layout/SimpleLayout'

import HomePage from '../pages/home/HomePage'
import Explore from '../pages/public/Explore'
import ServiceDetail from '../pages/public/ServiceDetail'
import BusinessPage from '../pages/public/BusinessPage'
import Login from '../pages/auth/Login'
import Activity from '../pages/customer/Activity'
import Profile from '../pages/customer/Profile'
import CustomerDashboard from '../pages/customer/Dashboard'
import OrderWizard from '../pages/order/OrderWizard'
import OrderDetail from '../pages/order/OrderDetail'
import ServicesPage from '../pages/services/ServicesPage'

import BusinessDashboard from '../pages/business/BusinessDashboard'
import BusinessMessages from '../pages/business/BusinessMessages'
import StaffManagement from '../pages/business/StaffManagement'
import CalendarManager from '../pages/business/CalendarManager'
import Clients from '../pages/business/Clients'
import ClientDetail from '../pages/business/ClientDetail'
import Finance from '../pages/business/Finance'
import Invoices from '../pages/business/Invoices'
import SocialMediaManager from '../pages/business/SocialMediaManager'
import MyPostsPage from '../pages/profile/MyPostsPage'
import UpgradeToBusiness from '../pages/profile/UpgradeToBusiness'
import NewsArticlePage from '../pages/home/NewsArticlePage'
import PostDetailPage from '../pages/social/PostDetailPage'
import MyServicesPage from '../pages/business/MyServicesPage'
import MyPackagesPage from '../pages/business/MyPackagesPage'
import InventoryPage from '../pages/business/InventoryPage'
import OnboardingWizard from '../pages/business/OnboardingWizard'

function ErrorBoundary() {
  const error = useRouteError()
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-white p-8">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-red-500 mb-4">{error.status}</h1>
          <p className="text-lg text-gray-300 mb-4">{error.statusText || 'An unexpected error occurred'}</p>
          <p className="text-sm text-gray-500 mb-6">{error.data?.message || ''}</p>
          <a href="/" className="text-blue-400 hover:underline">Return Home</a>
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-white p-8">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Oops!</h1>
        <p className="text-lg text-gray-300 mb-6">Something went wrong. Please try again.</p>
        <a href="/" className="text-blue-400 hover:underline">Return Home</a>
      </div>
    </div>
  )
}

function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/auth/login" replace />
  if (roles && user?.roles?.length) {
    const userRolesLower = user.roles.map((ur: string) => ur.toLowerCase())
    const hasRequiredRole = roles.some((r) => userRolesLower.includes(r.toLowerCase()))
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />
    }
  }
  return <>{children}</>
}

export const router = createBrowserRouter([
  // Public routes (no auth required) — with AppShell (header + bottom nav)
  {
    element: <PublicLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <Explore /> },
      { path: '/services/:id', element: <ServiceDetail /> },
      { path: '/biz/:id', element: <BusinessPage /> },
      { path: '/home', element: <HomePage /> },
      { path: '/home/news/:id', element: <NewsArticlePage /> },
      { path: '/social', element: <Explore /> },
      { path: '/biz-profile', element: <ServiceDetail /> },
      { path: '/explorer', element: <Explore /> },
      { path: '/explorer/general', element: <Explore /> },
      { path: '/explorer/business', element: <Explore /> },
      { path: '/post/:id', element: <PostDetailPage /> },
    ],
  },
  // Standalone routes — no AppShell (no bottom nav, no avatar header)
  {
    element: <SimpleLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/auth', element: <Login /> },
      { path: '/auth/login', element: <Login /> },
      { path: '/order/new', element: <OrderWizard /> },
      { path: '/orders/:id', element: <OrderDetail /> },
    ],
  },
  // Customer routes (auth required) — with AppShell
  {
    element: <RequireAuth roles={['customer', 'provider']}><CustomerLayout /></RequireAuth>,
    errorElement: <ErrorBoundary />,
    children: [
      { path: '/app/home', element: <HomePage /> },
      { path: '/app/orders', element: <CustomerDashboard /> },
      { path: '/app/services', element: <ServicesPage /> },
      { path: '/app/orders/:id', element: <OrderDetail /> },
      { path: '/app/social', element: <Explore /> },
      { path: '/app/activity', element: <Activity /> },
      { path: '/app/profile', element: <Profile /> },
      { path: '/activity', element: <Activity /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/posts', element: <MyPostsPage /> },
      { path: '/profile/upgrade', element: <UpgradeToBusiness /> },
    ],
  },
  // Business routes (auth required)
  {
    path: '/business/:workspaceId',
    element: <RequireAuth roles={['BUSINESS_OWNER', 'SOLO_PROVIDER', 'EMPLOYEE', 'provider']}><BusinessLayout /></RequireAuth>,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <BusinessDashboard /> },
      { path: 'staff', element: <StaffManagement /> },
      { path: 'calendar', element: <CalendarManager /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:customerId', element: <ClientDetail /> },
      { path: 'finance', element: <Finance /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'social', element: <SocialMediaManager /> },
      { path: 'messages', element: <BusinessMessages /> },
      { path: 'services', element: <MyServicesPage /> },
      { path: 'packages', element: <MyPackagesPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'onboarding', element: <OnboardingWizard /> },
    ],
  },
  // Flutter-compatible dashboard route
  {
    path: '/dashboard',
    element: <RequireAuth roles={['BUSINESS_OWNER', 'SOLO_PROVIDER', 'EMPLOYEE', 'provider', 'owner', 'platform_admin']}><BusinessLayout /></RequireAuth>,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <BusinessDashboard /> },
    ],
  },
])