import { createBrowserRouter, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { RequireAuth } from './RequireAuth.js'
import { lazy } from 'react'

import { PublicLayout } from '../components/layout/PublicLayout'
import { CustomerLayout } from '../components/layout/CustomerLayout'
import { BusinessLayout } from '../components/layout/BusinessLayout'
import { SimpleLayout } from '../components/layout/SimpleLayout'

const HomePage = lazy(() => import('../pages/home/HomePage'))
const Explore = lazy(() => import('../pages/public/Explore'))
const ServiceDetail = lazy(() => import('../pages/public/ServiceDetail'))
const BusinessPage = lazy(() => import('../pages/public/BusinessPage'))
const Login = lazy(() => import('../pages/auth/Login'))
const Activity = lazy(() => import('../pages/customer/Activity'))
const Profile = lazy(() => import('../pages/customer/Profile'))
const CustomerDashboard = lazy(() => import('../pages/customer/Dashboard'))
const OrderWizard = lazy(() => import('../pages/order/OrderWizard'))
const OrderDetail = lazy(() => import('../pages/order/OrderDetail'))
const ServicesPage = lazy(() => import('../pages/services/ServicesPage'))
const BusinessDashboard = lazy(() => import('../pages/business/BusinessDashboard'))
const BusinessMessages = lazy(() => import('../pages/business/BusinessMessages'))
const StaffManagement = lazy(() => import('../pages/business/StaffManagement'))
const CalendarManager = lazy(() => import('../pages/business/CalendarManager'))
const Clients = lazy(() => import('../pages/business/Clients'))
const ClientDetail = lazy(() => import('../pages/business/ClientDetail'))
const Finance = lazy(() => import('../pages/business/Finance'))
const Invoices = lazy(() => import('../pages/business/Invoices'))
const SocialMediaManager = lazy(() => import('../pages/business/SocialMediaManager'))
const MyPostsPage = lazy(() => import('../pages/profile/MyPostsPage'))
const UpgradeToBusiness = lazy(() => import('../pages/profile/UpgradeToBusiness'))
const KycVerification = lazy(() => import('../pages/profile/KycVerification'))
const NewsArticlePage = lazy(() => import('../pages/home/NewsArticlePage'))
const PostDetailPage = lazy(() => import('../pages/social/PostDetailPage'))
const MyServicesPage = lazy(() => import('../pages/business/MyServicesPage'))
const MyPackagesPage = lazy(() => import('../pages/business/MyPackagesPage'))
const InventoryPage = lazy(() => import('../pages/business/InventoryPage'))
const OnboardingWizard = lazy(() => import('../pages/business/OnboardingWizard'))

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
      { path: '/profile/kyc', element: <KycVerification /> },
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
