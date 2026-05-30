import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HomeBanner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
  sortOrder: number
  startDate: string | null
  endDate: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface HomeNewsArticle {
  id: string
  title: string
  body: string
  summary: string | null
  imageUrl: string | null
  category: 'sports' | 'community' | 'events' | 'city' | 'promotions'
  isActive: boolean
  isFeatured: boolean
  publishedAt: string | null
  scheduledAt: string | null
  expiresAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WeatherData {
  temp: number | null
  condition: string
  icon: string
  humidity: number | null
  windSpeed: number | null
  units: string
  enabled: boolean
  apiEndpoint?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface SafetyAlert {
  id: string
  title: string
  description: string | null
  severity: 'info' | 'warning' | 'critical'
  location: string | null
  latitude: number | null
  longitude: number | null
  source: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UtilityLink {
  id: string
  title: string
  url: string
  category: string
  iconUrl: string | null
  description: string | null
  commissionRate: number | null
  isActive: boolean
  sortOrder: number
  clickCount?: number
  _count?: { clicks: number }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const homeKeys = {
  all: ['home'] as const,
  banner: ['home', 'banner'] as const,
  news: (params?: { category?: string; page?: number }) => ['home', 'news', params] as const,
  weather: ['home', 'weather'] as const,
  alerts: ['home', 'alerts'] as const,
  utilityLinks: (category?: string) => ['home', 'utilityLinks', category] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch the active home banner */
export function useHomeBanner() {
  return useQuery({
    queryKey: homeKeys.banner,
    queryFn: async () => {
      const { data } = await api.get<{ data: HomeBanner | null }>('/home/banner')
      return data.data
    },
  })
}

/** Fetch published news articles */
export function useHomeNews(params?: { category?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: homeKeys.news(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<HomeNewsArticle>>('/home/news', { params })
      return data
    },
  })
}

/** Fetch weather config/data */
export function useWeather() {
  return useQuery({
    queryKey: homeKeys.weather,
    queryFn: async () => {
      const { data } = await api.get<{ data: WeatherData }>('/home/weather')
      return data.data
    },
  })
}

/** Fetch active safety alerts */
export function useActiveAlerts() {
  return useQuery({
    queryKey: homeKeys.alerts,
    queryFn: async () => {
      const { data } = await api.get<{ data: SafetyAlert[] }>('/home/alerts')
      return data.data
    },
  })
}

/** Fetch utility links, optionally filtered by category */
export function useUtilityLinks(category?: string) {
  return useQuery({
    queryKey: homeKeys.utilityLinks(category),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<UtilityLink>>('/home/utility-links', {
        params: category ? { category, pageSize: 50 } : { pageSize: 50 },
      })
      return data.data
    },
  })
}

/** Track a utility link click */
export function useTrackUtilityClick() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { data } = await api.post(`/home/utility-links/${linkId}/click`, {})
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', 'utilityLinks'] })
    },
  })
}

/** Search for services, businesses, skills */
export function useHomeSearch(query: string) {
  return useQuery({
    queryKey: ['home', 'search', query],
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{
        id: string
        type: 'service' | 'business' | 'category' | 'skill'
        title: string
        subtitle: string | null
        imageUrl: string | null
        rating?: number
        price?: number
        distance?: number
        availableNow?: boolean
      }> }>('/home/search', { params: { q: query } })
      return data.data
    },
    enabled: query.length >= 2,
  })
}