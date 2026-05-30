import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { ReactNode } from 'react'

import { PublicLayout } from '../components/layout/PublicLayout'
import { CustomerLayout } from '../components/layout/CustomerLayout'
import { BusinessLayout } from '../components/layout/BusinessLayout'

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
import MyServicesPage from '../pages/business/MyServicesPage'
import MyPackagesPage from '../pages/business/MyPackagesPage'
import InventoryPage from '../pages/business/InventoryPage'
import OnboardingWizard from '../pages/business/OnboardingWizard'

function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/auth/login" replace />
  if (roles && user && !roles.some((r) => user.roles.some((ur) => ur.toLowerCase() === r.toLowerCase()))) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export const router = createBrowserRouter([
  // Public routes (no auth required)
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <Explore /> },
      { path: '/services/:id', element: <ServiceDetail /> },
      { path: '/auth', element: <Login /> },
      { path: '/auth/login', element: <Login /> },
      // Order wizard (guest + authenticated)
      { path: '/order/new', element: <OrderWizard /> },
      { path: '/orders/:id', element: <OrderDetail /> },
      // Business public profile
      { path: '/biz/:id', element: <BusinessPage /> },
      // Flutter-compatible public routes
      { path: '/home', element: <HomePage /> },
      // News article detail
      { path: '/home/news/:id', element: <NewsArticlePage /> },
      { path: '/social', element: <Explore /> },
      { path: '/biz-profile', element: <ServiceDetail /> },
      // Explorer routes
      { path: '/explorer', element: <Explore /> },
      { path: '/explorer/general', element: <Explore /> },
      { path: '/explorer/business', element: <Explore /> },
    ],
  },
  // Customer routes (auth required)
  {
    element: <RequireAuth roles={['customer', 'provider']}><CustomerLayout /></RequireAuth>,
    children: [
      { path: '/app/home', element: <CustomerDashboard /> },
      { path: '/app/services', element: <ServicesPage /> },
      { path: '/app/orders/:id', element: <OrderDetail /> },
      { path: '/app/social', element: <Explore /> },
      { path: '/app/activity', element: <Activity /> },
      { path: '/app/profile', element: <Profile /> },
      // Flutter-compatible customer routes
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
    children: [
      { index: true, element: <BusinessDashboard /> },
    ],
  },
])