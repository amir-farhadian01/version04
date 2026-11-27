import { useState, useRef } from 'react'
import { useCreatePost, type CreatePostInput } from '../../services/socialFeedApi'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'

interface CreatePostModalProps {
  onClose: () => void
  onSuccess?: () => void
}

interface CategoryNode {
  id: string
  name: string
  children?: CategoryNode[]
}

export default function CreatePostModal({ onClose, onSuccess }: CreatePostModalProps) {
  const { user } = useAuthStore()
  const createPost = useCreatePost()
  const [caption, setCaption] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [isBusinessPost, setIsBusinessPost] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [selectedCategoryName, setSelectedCategoryName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCategories = async () => {
    try { const { data } = await api.get('/admin/categories-tree'); setCategories(data ?? []) } catch { /* ignore */ }
  }

  const handleOpenCategory = () => { if (categories.length === 0) loadCategories(); setShowCategoryPicker(true) }

  const selectCategory = (id: string, name: string) => {
    setCategoryId(id); setSelectedCategoryName(name); setShowCategoryPicker(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (mediaUrls.length + files.length > 10) { setError('Maximum 10 files allowed'); return }
    setUploading(true); setError(null)
    const newUrls: string[] = []
    for (let i = 0; i < files.length; i++) {
      newUrls.push(`https://media.neighborly.local/uploads/${Date.now()}-${files[i].name}`)
    }
    setMediaUrls((prev) => [...prev, ...newUrls])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeMedia = (index: number) => { setMediaUrls((prev) => prev.filter((_, i) => i !== index)) }

  const handleSubmit = async () => {
    if (!user) return
    if (!categoryId) { setError('Please select a category'); return }
    setError(null)
    const input: CreatePostInput = { categoryId, mediaUrls, mediaTypes: mediaUrls.map(() => 'image' as const), isBusinessPost }
    if (caption.trim()) input.caption = caption.trim()
    try { await createPost.mutateAsync(input); onSuccess?.(); onClose() }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create post') }
  }

  const renderCategoryTree = (nodes: CategoryNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.id}>
        <button type="button" onClick={() => selectCategory(node.id, node.name)}
          className="mx-1 my-px w-[calc(100%-0.5rem)] rounded-md border-0 bg-transparent px-[14px] py-2 text-left text-[13px] text-nh-text cursor-pointer transition-colors hover:bg-nh-surface-elevated"
          style={{ paddingLeft: `${14 + depth * 16}px` }}>
          {depth > 0 && '└ '}{node.name}
        </button>
        {node.children && node.children.length > 0 && renderCategoryTree(node.children, depth + 1)}
      </div>
    ))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <button type="button" onClick={onClose} aria-label="Close create post" className="absolute inset-0 border-0 bg-black/50 p-0 backdrop-blur-sm" />

      <div className="relative w-full max-w-[600px] max-h-[90vh] bg-nh-surface rounded-t-[20px] flex flex-col overflow-hidden border border-nh-border border-b-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-nh-border flex items-center relative">
          <div className="w-10 h-1 rounded-sm bg-nh-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[15px] font-semibold text-nh-text flex-1 mt-1">Create Post</span>
          <button type="button" onClick={onClose} aria-label="Close create post" className="border-0 bg-transparent px-1 text-xl text-nh-text-muted cursor-pointer">×</button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {showCategoryPicker ? (
            <div>
              <button type="button" onClick={() => setShowCategoryPicker(false)} className="mb-2 flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-nh-primary cursor-pointer">← Back</button>
              <div className="text-[13px] font-semibold text-nh-text mb-2">Select Category</div>
              <div className="max-h-[300px] overflow-y-auto">
                {categories.length === 0 ? (
                  <div className="text-xs text-nh-text-muted text-center py-6">Loading categories...</div>
                ) : renderCategoryTree(categories)}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-[14px]">
                <div className="text-xs font-semibold text-nh-text-secondary mb-1.5">Category *</div>
                <button type="button" onClick={handleOpenCategory}
                  className="flex w-full items-center justify-between rounded-[10px] border border-nh-border bg-nh-surface px-[14px] py-2.5 text-[13px] cursor-pointer"
                  style={{ color: selectedCategoryName ? 'var(--nh-text)' : 'var(--nh-text-muted)' }}>
                  <span>{selectedCategoryName || 'Select a category...'}</span>
                  <span className="text-nh-text-muted">›</span>
                </button>
              </div>

              <div className="mb-[14px]">
                <div className="text-xs font-semibold text-nh-text-secondary mb-1.5">Caption</div>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption..." rows={3} maxLength={2000}
                  className="w-full bg-nh-surface border border-nh-border rounded-[10px] px-[14px] py-2.5 text-[13px] text-nh-text resize-none outline-none font-inherit box-border" />
                <div className="text-[10px] text-nh-text-muted text-right mt-1">{caption.length}/2000</div>
              </div>

              <div className="mb-[14px]">
                <div className="text-xs font-semibold text-nh-text-secondary mb-1.5">Media (max 10)</div>
                {mediaUrls.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {mediaUrls.map((_, i) => (
                      <div key={i} className="w-[72px] h-[72px] rounded-lg bg-nh-surface relative overflow-hidden border border-nh-border">
                        <div className="w-full h-full flex items-center justify-center text-2xl text-nh-text-muted">🖼</div>
                        <button type="button" onClick={() => removeMedia(i)} aria-label="Remove media" className="absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-0 bg-black/60 text-[10px] text-white cursor-pointer">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-[10px] border-2 border-dashed border-nh-border bg-nh-surface p-5 text-center text-[13px] text-nh-text-muted cursor-pointer">
                  {uploading ? 'Uploading...' : '📷 Tap to add photos/videos'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
              </div>

              <div className="mb-[14px]">
                <button type="button" onClick={() => setIsBusinessPost(!isBusinessPost)} aria-pressed={isBusinessPost} className="flex items-center gap-2.5 border-0 bg-transparent p-0 text-left cursor-pointer">
                  <div className={`w-10 h-6 rounded-xl relative transition-colors duration-200 ${isBusinessPost ? 'bg-nh-accent' : 'bg-nh-border-elevated'}`}>
                    <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200" style={{ left: isBusinessPost ? '18px' : '2px' }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-nh-text">Business Post</div>
                    <div className="text-[10px] text-nh-text-muted">Mark as business promotional content</div>
                  </div>
                </button>
              </div>

              {error && (
                <div className="bg-nh-danger/10 rounded-lg px-3 py-2 text-xs text-nh-danger mb-[14px]">{error}</div>
              )}
            </>
          )}
        </div>

        {!showCategoryPicker && (
          <div className="px-4 py-3 border-t border-nh-border">
            <button type="button" onClick={handleSubmit} disabled={!categoryId || createPost.isPending}
              className={`w-full rounded-[10px] border-0 p-3 text-center text-sm font-semibold ${
                categoryId ? 'bg-nh-primary text-white cursor-pointer' : 'bg-nh-border-elevated text-nh-text-muted cursor-default'
              } ${createPost.isPending ? 'opacity-60' : ''}`}>
              {createPost.isPending ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
