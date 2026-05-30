import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import ActiveOffersTab from './tabs/ActiveOffersTab'
import OffersHistoryTab from './tabs/OffersHistoryTab'
import CompletedOrdersTab from './tabs/CompletedOrdersTab'

interface ProviderOrder {
  id: string
  title: string
  description: string | null
  status: string
  phase: string
  budget: number | null
  scheduledAt: string | null
  matchingExpiresAt: string | null
  createdAt: string
  updatedAt: string
  customerName: string
  customerAvatarUrl: string | null
  serviceName: string
  packageName: string | null
  packagePrice: number | null
  staffName: string | null
  staffAvatarUrl: string | null
  amount: number
  commission: number | null
  paymentRef: string | null
  completedAt: string | null
  workspaceId: string
  declineReason: string | null
  declinedAt: string | null
  matchedAt: string | null
}

interface CompletedOrder {
  id: string
  title: string
  clientName: string
  clientAvatarUrl: string | null
  packageName: string | null
  staffName: string | null
  amount: number
  commission: number | null
  paymentRef: string | null
  completedAt: string
  status: string
}

interface ApiOrderItem {
  id: string
  title?: string
  description?: string
  status: string
  phase: string
  budget?: number
  scheduledAt?: string
  matchingExpiresAt?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  matchedWorkspaceId?: string
  customer?: {
    displayName?: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
  }
  serviceCatalog?: {
    name?: string
  }
  matchedPackage?: {
    name?: string
    finalPrice?: number
  }
  matchedWorkspace?: {
    id?: string
  }
  assignedStaff?: {
    displayName?: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
  }
  payment?: {
    id?: string
    amount?: number
  }
}

interface ProviderOrdersResponse {
  items: ApiOrderItem[]
  total: number
  page: number
  pageSize: number
}

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'history', label: 'History' },
  { id: 'completed', label: 'Completed' },
] as const

type TabId = (typeof TABS)[number]['id']

function mapApiOrder(item: ApiOrderItem, fallbackWorkspaceId: string): ProviderOrder {
  const customer = item.customer ?? {}
  const serviceCatalog = item.serviceCatalog ?? {}
  const matchedPackage = item.matchedPackage ?? {}
  const assignedStaff = item.assignedStaff ?? {}
  const matchedWorkspace = item.matchedWorkspace ?? {}
  const payment = item.payment ?? {}

  const customerName =
    (customer.displayName?.trim()) ||
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
    'Customer'

  const staffName =
    (assignedStaff.displayName?.trim()) ||
    `${assignedStaff.firstName ?? ''} ${assignedStaff.lastName ?? ''}`.trim() ||
    null

  return {
    id: item.id,
    title: item.title ?? serviceCatalog.name ?? 'Untitled',
    description: item.description ?? null,
    status: item.status,
    phase: item.phase,
    budget: item.budget ?? null,
    scheduledAt: item.scheduledAt ?? null,
    matchingExpiresAt: item.matchingExpiresAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    customerName,
    customerAvatarUrl: customer.avatarUrl ?? null,
    serviceName: serviceCatalog.name ?? 'Unknown Service',
    packageName: matchedPackage.name ?? null,
    packagePrice: matchedPackage.finalPrice ?? null,
    staffName,
    staffAvatarUrl: assignedStaff.avatarUrl ?? null,
    amount: payment.amount ?? matchedPackage.finalPrice ?? 0,
    commission: null,
    paymentRef: payment.id ?? null,
    completedAt: item.completedAt ?? null,
    workspaceId: item.matchedWorkspaceId ?? matchedWorkspace.id ?? fallbackWorkspaceId,
    declineReason: null,
    declinedAt: null,
    matchedAt: null,
  }
}

function toCompletedOrder(o: ProviderOrder): CompletedOrder {
  return {
    id: o.id,
    title: o.title,
    clientName: o.customerName,
    clientAvatarUrl: o.customerAvatarUrl,
    packageName: o.packageName,
    staffName: o.staffName,
    amount: o.amount,
    commission: o.commission,
    paymentRef: o.paymentRef,
    completedAt: o.completedAt ?? o.updatedAt,
    status: o.status,
  }
}

export default function BusinessMessages() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('active')
  const [orders, setOrders] = useState<ProviderOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      let phases: string[] = []
      if (activeTab === 'active') {
        phases = ['negotiation', 'matching', 'contracted', 'in_progress']
      } else if (activeTab === 'history') {
        phases = ['cancelled', 'declined', 'superseded']
      } else if (activeTab === 'completed') {
        phases = ['completed', 'closed']
      }

      const res = await api.get<ProviderOrdersResponse>('/orders/provider/me', {
        params: {
          phases: phases.join(','),
          page: 1,
          pageSize: 50,
        },
      })

      const items = res.data.items ?? []
      const mapped: ProviderOrder[] = items.map((item) => mapApiOrder(item, workspaceId))
      setOrders(mapped)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load orders'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [workspaceId, activeTab])

  const activeOrders = orders.filter(
    (o) => ['matching', 'negotiation', 'contracted', 'in_progress'].includes(o.phase) ||
           ['matching', 'contracted', 'in_progress'].includes(o.status),
  )

  const historyOrders = orders.filter(
    (o) => ['cancelled'].includes(o.status) ||
           ['declined', 'superseded'].includes(o.phase),
  )

  const completedOrders = orders
    .filter((o) => ['completed', 'closed'].includes(o.status) || ['completed', 'closed'].includes(o.phase))
    .map(toCompletedOrder)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'active':
        return (
          <ActiveOffersTab
            offers={activeOrders}
            loading={loading}
            error={error}
            onRefresh={fetchOrders}
          />
        )
      case 'history':
        return (
          <OffersHistoryTab
            offers={historyOrders}
            loading={loading}
            error={error}
          />
        )
      case 'completed':
        return (
          <CompletedOrdersTab
            orders={completedOrders}
            loading={loading}
            error={error}
          />
        )
    }
  }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusBar title="9:41" showNotifDot />

      {/* Header */}
      <div style={{ background: 'var(--bg)', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={() => navigate(`/business/${workspaceId}`)} style={{ cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text)">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Messages
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Offers, Orders & Jobs
            </div>
          </div>
          <div onClick={fetchOrders} style={{ cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--text2)">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setOrders([])
            }}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text3)',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {renderTabContent()}
        <div style={{ height: 100 }} />
      </div>

      {/* Floating Bottom Nav */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, zIndex: 50 }}>
        <BottomNav
          items={[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
          ]}
        />
      </div>
    </div>
  )
}