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
        <div onClick={() => selectCategory(node.id, node.name)}
          className="px-[14px] py-2 text-[13px] text-nh-text cursor-pointer rounded-md mx-1 my-px transition-colors hover:bg-nh-surface-elevated"
          style={{ paddingLeft: `${14 + depth * 16}px` }}>
          {depth > 0 && '└ '}{node.name}
        </div>
        {node.children && node.children.length > 0 && renderCategoryTree(node.children, depth + 1)}
      </div>
    ))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-[600px] max-h-[90vh] bg-nh-surface rounded-t-[20px] flex flex-col overflow-hidden border border-nh-border border-b-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-nh-border flex items-center relative">
          <div className="w-10 h-1 rounded-sm bg-nh-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[15px] font-semibold text-nh-text flex-1 mt-1">Create Post</span>
          <div onClick={onClose} className="text-xl text-nh-text-muted cursor-pointer px-1">×</div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {showCategoryPicker ? (
            <div>
              <div onClick={() => setShowCategoryPicker(false)} className="text-xs text-nh-primary cursor-pointer mb-2 flex items-center gap-1">← Back</div>
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
                <div onClick={handleOpenCategory}
                  className="bg-nh-surface border border-nh-border rounded-[10px] px-[14px] py-2.5 text-[13px] flex items-center justify-between cursor-pointer"
                  style={{ color: selectedCategoryName ? 'var(--nh-text)' : 'var(--nh-text-muted)' }}>
                  <span>{selectedCategoryName || 'Select a category...'}</span>
                  <span className="text-nh-text-muted">›</span>
                </div>
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
                        <div onClick={() => removeMedia(i)} className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] cursor-pointer">×</div>
                      </div>
                    ))}
                  </div>
                )}
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-nh-border rounded-[10px] p-5 text-center cursor-pointer text-[13px] text-nh-text-muted bg-nh-surface">
                  {uploading ? 'Uploading...' : '📷 Tap to add photos/videos'}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
              </div>

              <div className="mb-[14px]">
                <div onClick={() => setIsBusinessPost(!isBusinessPost)} className="flex items-center gap-2.5 cursor-pointer">
                  <div className={`w-10 h-6 rounded-xl relative transition-colors duration-200 ${isBusinessPost ? 'bg-nh-accent' : 'bg-nh-border-elevated'}`}>
                    <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200" style={{ left: isBusinessPost ? '18px' : '2px' }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-nh-text">Business Post</div>
                    <div className="text-[10px] text-nh-text-muted">Mark as business promotional content</div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-nh-danger/10 rounded-lg px-3 py-2 text-xs text-nh-danger mb-[14px]">{error}</div>
              )}
            </>
          )}
        </div>

        {!showCategoryPicker && (
          <div className="px-4 py-3 border-t border-nh-border">
            <div onClick={handleSubmit}
              className={`rounded-[10px] p-3 text-center text-sm font-semibold ${
                categoryId ? 'bg-nh-primary text-white cursor-pointer' : 'bg-nh-border-elevated text-nh-text-muted cursor-default'
              } ${createPost.isPending ? 'opacity-60' : ''}`}>
              {createPost.isPending ? 'Publishing...' : 'Publish Post'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}