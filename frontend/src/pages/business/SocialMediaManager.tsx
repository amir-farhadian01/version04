import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

interface PostItem {
  id: string
  caption: string | null
  author: { id: string; displayName: string | null; avatarUrl: string | null }
  category: { id: string; name: string }
  media: Array<{ url: string; type: string; sortOrder: number }>
  _count: { likes: number; comments: number }
  publishedAt: string | null
  scheduledAt: string | null
  archivedAt: string | null
  moderationStatus: string
  createdAt: string
}

interface StoryItem {
  id: string
  mediaUrl: string
  mediaType: string
  thumbnailUrl: string | null
  caption: string | null
  views: number
  isActive: boolean
  author: { id: string; displayName: string | null; avatarUrl: string | null }
  createdAt: string
  expiresAt: string
}

interface CommentItem {
  id: string
  text: string
  author: { id: string; displayName: string | null; avatarUrl: string | null }
  post: { id: string; caption: string | null }
  createdAt: string
}

interface SocialRoleItem {
  id: string
  userId: string
  user: { id: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarUrl: string | null }
  grantedBy: { id: string; displayName: string | null } | null
  createdAt: string
}

type TabKey = 'posts' | 'stories' | 'comments' | 'roles'

export default function SocialMediaManager() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [activeTab, setActiveTab] = useState<TabKey>('posts')
  const [posts, setPosts] = useState<PostItem[]>([])
  const [stories, setStories] = useState<StoryItem[]>([])
  const [comments, setComments] = useState<CommentItem[]>([])
  const [roles, setRoles] = useState<SocialRoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('published')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editingPost, setEditingPost] = useState<PostItem | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [grantUserId, setGrantUserId] = useState('')
  const [showGrantInput, setShowGrantInput] = useState(false)

  const fetchPosts = () => {
    if (!workspaceId) return
    setLoading(true)
    api.get('/workspace/social/posts', { params: { workspaceId, status: statusFilter, page, pageSize: 20 } })
      .then((res) => {
        setPosts(res.data.data ?? [])
        setTotalPages(res.data.totalPages ? Math.ceil(res.data.total / 20) : 1)
      })
      .catch((err) => setError(err?.response?.data?.message ?? 'Failed to load posts'))
      .finally(() => setLoading(false))
  }

  const fetchStories = () => {
    if (!workspaceId) return
    api.get('/workspace/social/stories', { params: { workspaceId } })
      .then((res) => setStories(res.data.data ?? []))
      .catch(() => {})
  }

  const fetchComments = () => {
    if (!workspaceId) return
    api.get('/workspace/social/comments', { params: { workspaceId, page, pageSize: 20 } })
      .then((res) => setComments(res.data.data ?? []))
      .catch(() => {})
  }

  const fetchRoles = () => {
    if (!workspaceId) return
    api.get('/workspace/social/roles', { params: { workspaceId } })
      .then((res) => setRoles(res.data.data ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    switch (activeTab) {
      case 'posts': fetchPosts(); break
      case 'stories': fetchStories(); setLoading(false); break
      case 'comments': fetchComments(); break
      case 'roles': fetchRoles(); setLoading(false); break
    }
  }, [activeTab, workspaceId, page, statusFilter])

  const handleArchivePost = async (postId: string) => {
    if (!workspaceId || !confirm('Archive this post?')) return
    try {
      await api.delete(`/workspace/social/posts/${postId}`, { params: { workspaceId } })
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch { alert('Failed to archive post') }
  }

  const handleEditPost = (post: PostItem) => {
    setEditingPost(post)
    setEditCaption(post.caption ?? '')
  }

  const handleSaveEdit = async () => {
    if (!workspaceId || !editingPost) return
    try {
      await api.put(`/workspace/social/posts/${editingPost.id}`, { caption: editCaption }, { params: { workspaceId } })
      setEditingPost(null)
      fetchPosts()
    } catch { alert('Failed to update post') }
  }

  const handleReply = async (commentId: string) => {
    if (!workspaceId || !replyText.trim()) return
    try {
      await api.post(`/workspace/social/comments/${commentId}/reply`, { text: replyText }, { params: { workspaceId } })
      setReplyText('')
      setReplyingTo(null)
      alert('Reply sent!')
    } catch { alert('Failed to send reply') }
  }

  const handleGrantRole = async () => {
    if (!workspaceId || !grantUserId.trim()) return
    try {
      await api.put(`/workspace/social/roles/${grantUserId}`, { grant: true }, { params: { workspaceId } })
      setGrantUserId('')
      setShowGrantInput(false)
      fetchRoles()
      alert('Social media role granted!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to grant role'
      alert(msg)
    }
  }

  const handleRevokeRole = async (userId: string) => {
    if (!workspaceId || !confirm('Revoke social media access for this user?')) return
    try {
      await api.put(`/workspace/social/roles/${userId}`, { grant: false }, { params: { workspaceId } })
      fetchRoles()
    } catch { alert('Failed to revoke role') }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const thumbnailUrl = (post: PostItem): string | null => {
    return post.media?.[0]?.url ?? null
  }

  const TabButton = ({ tab, label, count }: { tab: TabKey; label: string; count?: number }) => (
    <button
      onClick={() => { setActiveTab(tab); setPage(1) }}
      className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
        activeTab === tab
          ? 'bg-nh-primary text-white'
          : 'bg-nh-surface-elevated text-nh-text-secondary hover:bg-nh-surface'
      }`}
    >
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  )

  return (
    <div className="min-h-screen bg-nh-bg">
      <StatusBar title="Social Media Manager" />
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <TabButton tab="posts" label="Posts" />
          <TabButton tab="stories" label="Stories" count={stories.filter(s => s.isActive).length} />
          <TabButton tab="comments" label="Comments" />
          <TabButton tab="roles" label="Roles" count={roles.length} />
        </div>

        {error && (
          <div className="bg-nh-danger/10 text-nh-danger p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div>
            <div className="flex gap-2 mb-4">
              {['published', 'scheduled', 'archived'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1) }}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    statusFilter === s ? 'border-nh-primary bg-nh-primary/10 text-nh-primary' : 'border-nh-border text-nh-text-muted'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-8 text-nh-text-muted">Loading...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-8 text-nh-text-muted">No posts found</div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border p-3">
                    {editingPost?.id === post.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          className="w-full border border-nh-border rounded-lg p-2 text-sm bg-nh-bg text-nh-text"
                          rows={3}
                          placeholder="Edit caption..."
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveEdit} className="px-3 py-1 bg-nh-primary text-white rounded text-sm">Save</button>
                          <button onClick={() => setEditingPost(null)} className="px-3 py-1 bg-nh-surface-elevated text-nh-text-secondary rounded text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        {thumbnailUrl(post) && (
                          <img src={thumbnailUrl(post)!} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2 mb-1 text-nh-text">{post.caption ?? '(no caption)'}</p>
                          <div className="flex items-center gap-3 text-xs text-nh-text-muted">
                            <span>❤ {post._count.likes}</span>
                            <span>💬 {post._count.comments}</span>
                            <span>{formatDate(post.publishedAt || post.scheduledAt)}</span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleEditPost(post)} className="text-xs text-nh-primary">Edit</button>
                            <button onClick={() => handleArchivePost(post.id)} className="text-xs text-nh-danger">Archive</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 border border-nh-border rounded text-sm disabled:opacity-30 text-nh-text-secondary">Prev</button>
                    <span className="px-3 py-1 text-sm text-nh-text-muted">{page} / {totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 border border-nh-border rounded text-sm disabled:opacity-30 text-nh-text-secondary">Next</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stories Tab */}
        {activeTab === 'stories' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-nh-text-secondary">
              Active Stories ({stories.filter(s => s.isActive).length})
            </h3>
            {stories.filter(s => s.isActive).map((story) => (
              <div key={story.id} className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border p-3 flex gap-3 items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-nh-purple to-nh-danger p-0.5">
                  <img src={story.mediaUrl} alt="" className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-nh-text">{story.author.displayName}</p>
                  <p className="text-xs text-nh-text-muted">{story.caption ?? 'No caption'} · {story.views} views</p>
                  <p className="text-xs text-nh-text-muted">Expires: {formatDate(story.expiresAt)}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-nh-success/10 text-nh-success rounded-full">Active</span>
              </div>
            ))}

            <h3 className="text-sm font-medium text-nh-text-secondary mt-6">
              Expired Stories ({stories.filter(s => !s.isActive).length})
            </h3>
            {stories.filter(s => !s.isActive).map((story) => (
              <div key={story.id} className="bg-nh-surface-elevated rounded-xl border border-nh-border p-3 flex gap-3 items-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-nh-surface p-0.5">
                  <img src={story.mediaUrl} alt="" className="w-full h-full rounded-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-nh-text">{story.author.displayName}</p>
                  <p className="text-xs text-nh-text-muted">Expired: {formatDate(story.expiresAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-nh-text-muted">Loading...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-nh-text-muted">No comments yet</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-nh-surface-elevated flex items-center justify-center text-xs font-medium text-nh-text-secondary">
                      {comment.author.displayName?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-nh-text">{comment.author.displayName}</p>
                      <p className="text-xs text-nh-text-muted">{formatDate(comment.createdAt)}</p>
                    </div>
                  </div>
                  <p className="text-sm mb-2 text-nh-text">{comment.text}</p>
                  <p className="text-xs text-nh-text-muted mb-2">On post: {comment.post.caption ?? '(no caption)'}</p>

                  {replyingTo === comment.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 border border-nh-border rounded-lg px-3 py-1 text-sm bg-nh-bg text-nh-text"
                        onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
                      />
                      <button onClick={() => handleReply(comment.id)} className="px-3 py-1 bg-nh-primary text-white rounded text-sm">Send</button>
                      <button onClick={() => setReplyingTo(null)} className="px-3 py-1 bg-nh-surface-elevated text-nh-text-secondary rounded text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyingTo(comment.id)} className="text-xs text-nh-primary">Reply</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <button
              onClick={() => setShowGrantInput(!showGrantInput)}
              className="w-full px-4 py-2 bg-nh-primary text-white text-sm rounded-lg"
            >
              {showGrantInput ? 'Cancel' : '+ Grant Social Media Role'}
            </button>

            {showGrantInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  placeholder="Enter user ID..."
                  className="flex-1 border border-nh-border rounded-lg px-3 py-2 text-sm bg-nh-bg text-nh-text"
                />
                <button onClick={handleGrantRole} className="px-4 py-2 bg-nh-success text-white text-sm rounded-lg">Grant</button>
              </div>
            )}

            {roles.length === 0 ? (
              <div className="text-center py-8 text-nh-text-muted">No social media roles granted yet</div>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-nh-primary/10 flex items-center justify-center text-sm font-medium text-nh-primary">
                      {role.user.displayName?.[0] ?? role.user.firstName?.[0] ?? '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-nh-text">{role.user.displayName ?? `${role.user.firstName} ${role.user.lastName}`}</p>
                      <p className="text-xs text-nh-text-muted">
                        Granted by {role.grantedBy?.displayName ?? 'Unknown'} on {formatDate(role.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeRole(role.userId)}
                      className="px-3 py-1 text-xs text-nh-danger border border-nh-danger/20 rounded-full hover:bg-nh-danger/10"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="absolute left-0 right-0 bottom-6 z-50">
        <BottomNav
          items={[
            { id: 'dash', label: 'Dashboard', icon: NavIcons.business, isBiz: true },
            { id: 'social', label: 'Social', icon: NavIcons.social, active: true },
          ]}
        />
      </div>
    </div>
  )
}