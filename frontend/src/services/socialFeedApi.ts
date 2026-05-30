import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import api from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostMedia {
  id: string
  url: string
  type: 'image' | 'video'
  sortOrder: number
}

export interface PostAuthor {
  id: string
  displayName: string | null
  avatarUrl: string | null
  bio?: string | null
}

export interface PostCategory {
  id: string
  name: string
}

export interface PostLocation {
  id: string
  city: string | null
  neighborhood: string | null
  latitude: number
  longitude: number
}

export interface PostLinkedService {
  id: string
  name: string
  slug?: string | null
}

export interface FeedPost {
  id: string
  authorId: string
  caption: string | null
  isBusinessPost: boolean
  moderationStatus: string
  publishedAt: string
  createdAt: string
  updatedAt: string
  likeCount: number
  commentCount: number
  saveCount: number
  viewCount: number
  author: PostAuthor
  category: PostCategory
  location: PostLocation | null
  media: PostMedia[]
  linkedService: PostLinkedService | null
  _count: { likes: number; comments: number }
  isLiked: boolean
  isSaved: boolean
}

export interface FeedQueryParams {
  page?: number
  pageSize?: number
  categoryId?: string
  city?: string
  lat?: number
  lng?: number
  radiusKm?: number
  sort?: 'recent' | 'popular' | 'relevance'
  businessOnly?: boolean
  followingOnly?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface StoryAuthor {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export interface StoryItem {
  id: string
  mediaUrl: string
  thumbnailUrl: string | null
  mediaType: 'image'
  duration: number
  viewCount: number
  createdAt: string
  expiresAt: string
  viewed: boolean
}

export interface StoryGroup {
  author: StoryAuthor
  stories: StoryItem[]
}

export interface PostComment {
  id: string
  postId: string
  authorId: string
  text: string
  moderationStatus: string
  createdAt: string
  author: PostAuthor
}

export interface CreatePostInput {
  caption?: string
  categoryId: string
  locationId?: string
  mediaUrls: string[]
  mediaTypes?: ('image' | 'video')[]
  serviceCatalogId?: string
  isBusinessPost?: boolean
}

export interface CreateCommentInput {
  text: string
}

export interface CreateStoryInput {
  mediaUrl: string
  mediaType: 'image' | 'video'
  duration?: number
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

const feedKeys = {
  all: ['social', 'feed'] as const,
  list: (params: FeedQueryParams) => ['social', 'feed', 'list', params] as const,
  post: (id: string) => ['social', 'post', id] as const,
  comments: (postId: string) => ['social', 'comments', postId] as const,
  stories: ['social', 'stories'] as const,
  myPosts: ['social', 'myPosts'] as const,
  savedPosts: ['social', 'savedPosts'] as const,
}

// ─── Feed Posts ──────────────────────────────────────────────────────────────

export function useFeedPosts(params: FeedQueryParams = {}) {
  return useQuery({
    queryKey: feedKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<FeedPost>>('/social/posts/feed', { params })
      return data
    },
    placeholderData: (prev) => prev,
  })
}

export function useFeedPostsInfinite(params: Omit<FeedQueryParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: ['social', 'feed', 'infinite', params],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedResponse<FeedPost>>('/social/posts/feed', {
        params: { ...params, page: pageParam },
      })
      return data
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page * lastPage.pageSize >= lastPage.total) return undefined
      return lastPage.page + 1
    },
    initialPageParam: 1,
  })
}

// ─── Single Post ─────────────────────────────────────────────────────────────

export function usePostDetail(postId: string | undefined) {
  return useQuery({
    queryKey: feedKeys.post(postId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<{ data: FeedPost }>(`/social/posts/${postId}`)
      return data.data
    },
    enabled: !!postId,
  })
}

// ─── Create Post ─────────────────────────────────────────────────────────────

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const { data } = await api.post('/social/posts', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'myPosts'] })
    },
  })
}

// ─── Update Post ─────────────────────────────────────────────────────────────

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, ...input }: { postId: string; caption?: string; categoryId?: string; locationId?: string | null; serviceCatalogId?: string | null }) => {
      const { data } = await api.put(`/social/posts/${postId}`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'myPosts'] })
    },
  })
}

// ─── Delete (Archive) Post ────────────────────────────────────────────────────

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await api.delete(`/social/posts/${postId}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'myPosts'] })
    },
  })
}

// ─── Like / Unlike ──────────────────────────────────────────────────────────

export function useToggleLike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await api.post(`/social/posts/${postId}/like`)
      return data.data as { liked: boolean; postId: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
    },
  })
}

// ─── Save / Unsave ──────────────────────────────────────────────────────────

export function useToggleSave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data } = await api.post(`/social/posts/${postId}/save`)
      return data.data as { saved: boolean; postId: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'savedPosts'] })
    },
  })
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: feedKeys.comments(postId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<PostComment>>(`/social/posts/${postId}/comments`)
      return data
    },
    enabled: !!postId,
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, text }: { postId: string; text: string }) => {
      const { data } = await api.post(`/social/posts/${postId}/comments`, { text })
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedKeys.comments(variables.postId) })
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: string; commentId: string }) => {
      const { data } = await api.delete(`/social/posts/${postId}/comments/${commentId}`)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedKeys.comments(variables.postId) })
    },
  })
}

// ─── Stories ─────────────────────────────────────────────────────────────────

export function useStoriesFeed() {
  return useQuery({
    queryKey: feedKeys.stories,
    queryFn: async () => {
      const { data } = await api.get<{ data: StoryGroup[] }>('/social/stories/feed')
      return data.data
    },
  })
}

export function useCreateStory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateStoryInput) => {
      const { data } = await api.post('/social/stories', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.stories })
    },
  })
}

// ─── Follow / Unfollow ─────────────────────────────────────────────────────

export function useFollowUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/social/users/${userId}/follow`)
      return data.data as { following: boolean; userId: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] })
    },
  })
}

// ─── My Posts ───────────────────────────────────────────────────────────────

export function useMyPosts(params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['social', 'myPosts', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<FeedPost>>('/social/posts/my', { params })
      return data
    },
  })
}

// ─── Saved Posts ────────────────────────────────────────────────────────────

export function useSavedPosts(params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['social', 'savedPosts', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<FeedPost>>('/social/posts/saved', { params })
      return data
    },
  })
}

// ─── User Posts (for profile/business pages) ────────────────────────────────

export function useUserPosts(userId: string | undefined, params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['social', 'userPosts', userId, params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<FeedPost>>('/social/posts/feed', {
        params: { ...params, authorId: userId },
      })
      return data
    },
    enabled: !!userId,
  })
}