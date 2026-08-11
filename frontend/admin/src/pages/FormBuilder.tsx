import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Send,
  Eye,
  EyeOff,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import { cn } from '../lib/cn'

// ── Types ──────────────────────────────────────────────────────────────────

interface DynamicFieldSpec {
  key: string
  label: string
  type: DynamicFieldType
  required: boolean
  placeholder?: string
  helpText?: string
  validation?: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string; patternMessage?: string }
  options?: string[]
  rangeMin?: number
  rangeMax?: number
  rangeStep?: number
  rangeUnit?: string
  maxPhotos?: number
  conditionalOn?: { field: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in'; value: unknown }
  sortOrder?: number
}

type DynamicFieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'boolean' | 'file' | 'photo' | 'location' | 'range' | 'rating'

interface TemplateVersion {
  id: string
  version: number
  isActive: boolean
  schema: DynamicFieldSpec[]
  generatedByAi: boolean
  aiPrompt?: string
  aiModel?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

interface ServiceCatalog {
  id: string
  name: string
  category: string
  description?: string
}

interface GenerateResponse {
  templateId: string
  version: number
  schema: DynamicFieldSpec[]
  generatedByAi: boolean
  aiModel: string
  status: string
  message: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: DynamicFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'photo', label: 'Photo Upload' },
  { value: 'range', label: 'Range Slider' },
  { value: 'rating', label: 'Rating' },
  { value: 'location', label: 'Location' },
  { value: 'file', label: 'File Upload' },
]

const SORT_BY: Record<string, number> = { text: 0, textarea: 1, number: 2, date: 3, datetime: 4, select: 5, boolean: 6, photo: 7, range: 8, rating: 9 }
FIELD_TYPES.sort((a, b) => (SORT_BY[a.value] ?? 99) - (SORT_BY[b.value] ?? 99))

// ── Component ───────────────────────────────────────────────────────────────

export default function FormBuilder() {
  const { catalogId } = useParams<{ catalogId: string }>()
  const navigate = useNavigate()

  // Service catalog info
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)

  // Template versions
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // Current editing state
  const [fields, setFields] = useState<DynamicFieldSpec[]>([])
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  const [isDraft, setIsDraft] = useState(true)

  // AI generation
  const [aiPrompt, setAiPrompt] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showAISection, setShowAISection] = useState(true)

  // Actions
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Expanded field index for inline editing
  const [expandedField, setExpandedField] = useState<number | null>(null)

  // ── Load catalog + versions ──────────────────────────────────────────────

  useEffect(() => {
    if (!catalogId) return
    setCatalogLoading(true)
    api
      .get<{ data: ServiceCatalog }>(`/admin/service-definitions/${catalogId}`)
      .then((res) => {
        setCatalog(res.data.data)
        setServiceName(res.data.data.name)
      })
      .catch(() => showStatus('error', 'Failed to load service catalog'))
      .finally(() => setCatalogLoading(false))

    loadVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogId])

  const loadVersions = useCallback(async () => {
    if (!catalogId) return
    setVersionsLoading(true)
    try {
      const res = await api.get<{ data: TemplateVersion[] }>(`/service-catalog/admin/${catalogId}/form-template`)
      const templates = res.data.data ?? []
      setVersions(templates)
      // Auto-load active template or latest draft
      const active = templates.find((t) => t.isActive)
      if (active) {
        setFields((active.schema as DynamicFieldSpec[]) ?? [])
        setCurrentTemplateId(active.id)
        setIsDraft(false)
        setExpandedField(null)
      } else if (templates.length > 0) {
        const draft = templates.find((t) => !t.isActive) ?? templates[0]
        setFields((draft.schema as DynamicFieldSpec[]) ?? [])
        setCurrentTemplateId(draft.id)
        setIsDraft(true)
        setExpandedField(null)
      }
    } catch {
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }, [catalogId])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 4000)
  }

  const blankField = (): DynamicFieldSpec => ({
    key: `field_${Date.now()}`,
    label: 'New Field',
    type: 'text',
    required: false,
    sortOrder: fields.length,
  })

  // ── AI Generation ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!catalogId || !aiPrompt.trim()) {
      showStatus('error', 'Please enter a prompt describing the service')
      return
    }
    setGenerating(true)
    setStatusMessage(null)
    try {
      const res = await api.post<{ data: GenerateResponse }>(
        `/service-catalog/admin/${catalogId}/form-template/generate`,
        {
          serviceName: serviceName || catalog?.name || 'Service',
          category: catalog?.category ?? 'General',
          description: aiPrompt,
          businessType: businessType || 'General',
        },
      )
      const generated = res.data.data
      setFields(generated.schema)
      setCurrentTemplateId(generated.templateId)
      setIsDraft(true)
      setExpandedField(null)
      showStatus('success', generated.message)
      loadVersions()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message
        ?? 'Generation failed'
      showStatus('error', msg)
    } finally {
      setGenerating(false)
    }
  }

  // ── Field CRUD ───────────────────────────────────────────────────────────

  const addField = () => {
    setFields([...fields, blankField()])
  }

  const removeField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index)
    setFields(updated.map((f, i) => ({ ...f, sortOrder: i })))
    if (expandedField === index) setExpandedField(null)
    else if (expandedField !== null && expandedField > index) setExpandedField(expandedField - 1)
  }

  const updateField = (index: number, patch: Partial<DynamicFieldSpec>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...patch }
    setFields(updated)
  }

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return
    const updated = [...fields]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    setFields(updated.map((f, i) => ({ ...f, sortOrder: i })))
  }

  // ── Save Draft ───────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!catalogId || !currentTemplateId || !isDraft) {
      showStatus('error', 'No draft to save')
      return
    }
    setSaving(true)
    setStatusMessage(null)
    try {
      await api.put(`/service-catalog/admin/${catalogId}/form-template/${currentTemplateId}`, {
        schema: fields,
        generatedByAi: false,
      })
      showStatus('success', 'Draft saved')
      loadVersions()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message
        ?? 'Save failed'
      showStatus('error', msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!catalogId || !currentTemplateId) {
      showStatus('error', 'No template to publish')
      return
    }
    setPublishing(true)
    setStatusMessage(null)
    try {
      await api.post(`/service-catalog/admin/${catalogId}/form-template/${currentTemplateId}/publish`)
      showStatus('success', 'Template published!')
      loadVersions()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err as Error)?.message
        ?? 'Publish failed'
      showStatus('error', msg)
    } finally {
      setPublishing(false)
    }
  }

  // ── Load version ─────────────────────────────────────────────────────────

  const loadVersion = (version: TemplateVersion) => {
    setFields((version.schema as DynamicFieldSpec[]) ?? [])
    setCurrentTemplateId(version.id)
    setIsDraft(!version.isActive)
    setExpandedField(null)
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-nh-admin-primary" />
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-12 w-12 text-nh-admin-danger" />
        <p className="text-nh-admin-text-secondary">Service catalog not found</p>
        <button onClick={() => navigate('/admin')} className="text-sm text-nh-admin-primary hover:underline">
          Back to Dashboard
        </button>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Status Toast */}
      {statusMessage && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold',
            statusMessage.type === 'success'
              ? 'border-nh-admin-success/30 bg-nh-admin-success-bg text-nh-admin-success'
              : 'border-nh-admin-danger/30 bg-nh-admin-danger-bg text-nh-admin-danger',
          )}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {statusMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-xs font-semibold text-nh-admin-text-muted hover:text-nh-admin-text transition-colors mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-nh-admin-text font-heading">{catalog.name}</h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Form Builder — Dynamic Order Intake Template</p>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && currentTemplateId && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2.5 text-sm font-bold text-nh-admin-text transition-all hover:border-nh-admin-primary hover:text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Draft
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || fields.length === 0}
                className="flex items-center gap-2 rounded-xl border border-nh-admin-success/30 bg-nh-admin-success-bg px-4 py-2.5 text-sm font-bold text-nh-admin-success transition-all hover:bg-nh-admin-success hover:text-white disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish Template
              </button>
            </>
          )}
          {!isDraft && currentTemplateId && (
            <div className="flex items-center gap-1.5 rounded-xl border border-nh-admin-primary/20 bg-nh-admin-primary-bg px-3 py-2 text-xs font-bold text-nh-admin-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Published
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Generation Section */}
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface overflow-hidden">
            <button
              onClick={() => setShowAISection(!showAISection)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-nh-admin-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-nh-admin-primary" />
                <span className="text-sm font-bold text-nh-admin-text">AI Form Generator</span>
              </div>
              {showAISection ? <ChevronUp className="h-4 w-4 text-nh-admin-text-muted" /> : <ChevronDown className="h-4 w-4 text-nh-admin-text-muted" />}
            </button>
            {showAISection && (
              <div className="border-t border-nh-admin-border px-5 py-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                      Service Name
                    </label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text placeholder:text-nh-admin-text-muted focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
                      placeholder="e.g. Residential Painting"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                      Business Type
                    </label>
                    <input
                      type="text"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text placeholder:text-nh-admin-text-muted focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
                      placeholder="e.g. Solo painter, Cleaning company"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                    AI Prompt — Describe what questions to ask
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text placeholder:text-nh-admin-text-muted focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary resize-none"
                    placeholder="e.g. Collect room dimensions, surface type (drywall/plaster/brick), current paint condition, preferred finish (matte/eggshell/semi-gloss), and number of coats needed..."
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !aiPrompt.trim()}
                  className="flex items-center gap-2 rounded-xl border border-nh-admin-primary/30 bg-nh-admin-primary-bg px-5 py-2.5 text-sm font-bold text-nh-admin-primary transition-all hover:bg-nh-admin-primary hover:text-white disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Form Fields
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Field List */}
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-nh-admin-border">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-nh-admin-primary" />
                <span className="text-sm font-bold text-nh-admin-text">Form Fields ({fields.length})</span>
              </div>
              <button
                onClick={addField}
                className="flex items-center gap-1.5 rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-1.5 text-xs font-bold text-nh-admin-text-secondary transition-all hover:border-nh-admin-primary hover:text-nh-admin-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Field
              </button>
            </div>
            <div className="divide-y divide-nh-admin-border">
              {fields.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="h-10 w-10 text-nh-admin-text-muted" />
                  <p className="text-sm text-nh-admin-text-secondary">No fields yet.</p>
                  <p className="text-xs text-nh-admin-text-muted">Use the AI generator or add fields manually.</p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <FieldEditor
                    key={`${field.key}-${index}`}
                    field={field}
                    index={index}
                    total={fields.length}
                    expanded={expandedField === index}
                    onToggle={() => setExpandedField(expandedField === index ? null : index)}
                    onUpdate={(patch) => updateField(index, patch)}
                    onRemove={() => removeField(index)}
                    onMove={(to) => moveField(index, to)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar — Version History */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-nh-admin-border">
              <History className="h-5 w-5 text-nh-admin-primary" />
              <span className="text-sm font-bold text-nh-admin-text">Version History</span>
              {versionsLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-nh-admin-text-muted" />}
            </div>
            <div className="divide-y divide-nh-admin-border max-h-96 overflow-y-auto">
              {versions.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs text-nh-admin-text-muted">No versions yet.</p>
                </div>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => loadVersion(v)}
                    className={cn(
                      'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-nh-admin-surface-hover',
                      v.id === currentTemplateId && 'bg-nh-admin-primary-bg/50',
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black',
                      v.isActive
                        ? 'bg-nh-admin-success-bg text-nh-admin-success'
                        : 'bg-nh-admin-surface-elevated text-nh-admin-text-muted',
                    )}>
                      v{v.version}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-nh-admin-text">
                          {v.isActive ? 'Active' : 'Draft'}
                        </span>
                        {v.generatedByAi && (
                          <span className="text-[10px] font-semibold text-nh-admin-primary">AI</span>
                        )}
                      </div>
                      <p className="text-[11px] text-nh-admin-text-muted truncate">
                        {new Date(v.createdAt).toLocaleDateString()} — {(v.schema as unknown[])?.length ?? 0} fields
                      </p>
                    </div>
                    {v.id === currentTemplateId && (
                      <Eye className="h-3.5 w-3.5 shrink-0 text-nh-admin-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Field Editor Sub-Component ──────────────────────────────────────────────

function FieldEditor({
  field,
  index,
  total,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onMove,
}: {
  field: DynamicFieldSpec
  index: number
  total: number
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<DynamicFieldSpec>) => void
  onRemove: () => void
  onMove: (to: number) => void
}) {
  const needsOptions = field.type === 'select' || field.type === 'multiselect'
  const needsRange = field.type === 'range'
  const needsPhoto = field.type === 'photo'

  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'))
  const [conditionalField, setConditionalField] = useState(field.conditionalOn?.field ?? '')
  const [conditionalOperator, setConditionalOperator] = useState(field.conditionalOn?.operator ?? 'eq')
  const [conditionalValue, setConditionalValue] = useState(String(field.conditionalOn?.value ?? ''))

  useEffect(() => {
    setOptionsText((field.options ?? []).join('\n'))
    setConditionalField(field.conditionalOn?.field ?? '')
    setConditionalOperator(field.conditionalOn?.operator ?? 'eq')
    setConditionalValue(String(field.conditionalOn?.value ?? ''))
  }, [field.options, field.conditionalOn])

  const applyOptions = () => {
    const opts = optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    onUpdate({ options: opts })
  }

  const applyConditional = () => {
    if (conditionalField.trim()) {
      onUpdate({
        conditionalOn: {
          field: conditionalField.trim(),
          operator: conditionalOperator,
          value: conditionalValue,
        },
      })
    } else {
      onUpdate({ conditionalOn: undefined })
    }
  }

  return (
    <div className={cn('transition-colors', expanded && 'bg-nh-admin-surface-elevated')}>
      {/* Collapsed row */}
      <div className="flex items-center gap-2 px-5 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            className="text-nh-admin-text-muted hover:text-nh-admin-text disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
            className="text-nh-admin-text-muted hover:text-nh-admin-text disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <GripVertical className="h-3.5 w-3.5 text-nh-admin-text-muted ml-1" />
        </div>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span className="text-xs font-bold text-nh-admin-text truncate">{field.label}</span>
          <span className="shrink-0 rounded-md border border-nh-admin-border px-1.5 py-0.5 text-[10px] font-semibold text-nh-admin-text-muted uppercase">
            {field.type}
          </span>
          {field.required && (
            <span className="shrink-0 rounded-md bg-nh-admin-danger-bg px-1.5 py-0.5 text-[10px] font-semibold text-nh-admin-danger">
              Required
            </span>
          )}
          {field.conditionalOn && (
            <span className="shrink-0 rounded-md bg-nh-admin-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-nh-admin-warning">
              Conditional
            </span>
          )}
        </button>
        <button
          onClick={onRemove}
          className="shrink-0 text-nh-admin-text-muted hover:text-nh-admin-danger transition-colors p-1"
          title="Remove field"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-nh-admin-border px-5 py-4 space-y-4">
          {/* Basic info */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                Field Key (snake_case)
              </label>
              <input
                type="text"
                value={field.key}
                onChange={(e) => onUpdate({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text font-mono focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                Label
              </label>
              <input
                type="text"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                Type
              </label>
              <select
                value={field.type}
                onChange={(e) => onUpdate({ type: e.target.value as DynamicFieldType })}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type-specific editors */}
          {needsOptions && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">
                Options (one per line)
              </label>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                onBlur={applyOptions}
                rows={4}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text font-mono focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary resize-none"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          )}

          {needsRange && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Min</label>
                <input
                  type="number"
                  value={field.rangeMin ?? 0}
                  onChange={(e) => onUpdate({ rangeMin: Number(e.target.value) })}
                  className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Max</label>
                <input
                  type="number"
                  value={field.rangeMax ?? 100}
                  onChange={(e) => onUpdate({ rangeMax: Number(e.target.value) })}
                  className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Unit</label>
                <input
                  type="text"
                  value={field.rangeUnit ?? ''}
                  onChange={(e) => onUpdate({ rangeUnit: e.target.value })}
                  className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
                  placeholder="e.g. sq ft"
                />
              </div>
            </div>
          )}

          {needsPhoto && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Max Photos</label>
              <input
                type="number"
                value={field.maxPhotos ?? 5}
                onChange={(e) => onUpdate({ maxPhotos: Math.min(Number(e.target.value), 10) })}
                min={1}
                max={10}
                className="w-24 rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              />
            </div>
          )}

          {/* Placeholder & Help Text */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Placeholder</label>
              <input
                type="text"
                value={field.placeholder ?? ''}
                onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted mb-1">Help Text</label>
              <input
                type="text"
                value={field.helpText ?? ''}
                onChange={(e) => onUpdate({ helpText: e.target.value || undefined })}
                className="w-full rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none focus:ring-1 focus:ring-nh-admin-primary"
              />
            </div>
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpdate({ required: !field.required })}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                field.required
                  ? 'bg-nh-admin-danger-bg text-nh-admin-danger border border-nh-admin-danger/30'
                  : 'bg-nh-admin-bg text-nh-admin-text-muted border border-nh-admin-border',
              )}
            >
              {field.required ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {field.required ? 'Required' : 'Optional'}
            </button>
          </div>

          {/* Conditional logic */}
          <div className="rounded-xl border border-nh-admin-border bg-nh-admin-bg p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-muted">Conditional Visibility</p>
            <div className="grid gap-2 sm:grid-cols-4">
              <div>
                <label className="block text-[10px] text-nh-admin-text-muted mb-0.5">Depends on field</label>
                <input
                  type="text"
                  value={conditionalField}
                  onChange={(e) => setConditionalField(e.target.value)}
                  onBlur={applyConditional}
                  placeholder="field_key"
                  className="w-full rounded-md border border-nh-admin-border bg-nh-admin-surface px-2 py-1.5 text-xs text-nh-admin-text font-mono focus:border-nh-admin-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-nh-admin-text-muted mb-0.5">Operator</label>
                <select
                  value={conditionalOperator}
                  onChange={(e) => { setConditionalOperator(e.target.value as 'eq' | 'neq' | 'gt' | 'lt' | 'in'); applyConditional() }}
                  className="w-full rounded-md border border-nh-admin-border bg-nh-admin-surface px-2 py-1.5 text-xs text-nh-admin-text focus:border-nh-admin-primary focus:outline-none"
                >
                  <option value="eq">equals</option>
                  <option value="neq">not equals</option>
                  <option value="gt">greater than</option>
                  <option value="lt">less than</option>
                  <option value="in">in (comma separated)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-nh-admin-text-muted mb-0.5">Value</label>
                <input
                  type="text"
                  value={conditionalValue}
                  onChange={(e) => setConditionalValue(e.target.value)}
                  onBlur={applyConditional}
                  placeholder="e.g. true, or option1,option2"
                  className="w-full rounded-md border border-nh-admin-border bg-nh-admin-surface px-2 py-1.5 text-xs text-nh-admin-text font-mono focus:border-nh-admin-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}