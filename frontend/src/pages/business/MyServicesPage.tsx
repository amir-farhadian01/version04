import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { StatusBar } from '../../components/ui/phone/StatusBar';
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
interface ServiceItem {
  id: string;
  title: string;
  category: string | null;
  price: number;
  description: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  createdAt: string;
  archivedAt: string | null;
  serviceCatalogId: string | null;
}

interface ServiceFormData {
  title: string;
  category: string;
  price: string;
  description: string;
}

const INITIAL_FORM: ServiceFormData = { title: '', category: '', price: '', description: '' };

const BUSINESS_NAV = [
  { id: 'home', label: 'Home', icon: NavIcons.home },
  { id: 'social', label: 'Social', icon: NavIcons.social },
  { id: 'activity', label: 'Activity', icon: NavIcons.activity },
  { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
] as const;

// --- Hooks ---
function useServices() {
  return useQuery<ServiceItem[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await api.get('/services');
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    staleTime: 30_000,
  });
}

function useArchiveService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'archive' | 'unarchive' }) => {
      await api.post(`/services/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

// --- Sub-components ---

function ServiceListEmpty() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="text-5xl mb-4">🔧</div>
      <div className="text-base font-semibold text-foreground mb-1">No services yet</div>
      <div className="text-xs">Add your first service to get started</div>
    </div>
  );
}

interface ServiceCardProps {
  service: ServiceItem;
  onEdit: (s: ServiceItem) => void;
  onArchive: (s: ServiceItem) => void;
  onUnarchive: (s: ServiceItem) => void;
}

function ServiceCard({ service, onEdit, onArchive, onUnarchive }: ServiceCardProps) {
  const formatPrice = (cents: number) => '$' + (cents / 100).toFixed(2);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className={`rounded-xl p-4 mx-4 mb-2.5 border border-border ${service.archivedAt ? 'bg-yellow-50/50 dark:bg-yellow-900/10 opacity-70' : 'bg-card'}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {service.imageUrl && (
              <img src={service.imageUrl} alt={service.title} className="w-10 h-10 rounded-lg object-cover" />
            )}
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                {service.title}
                {service.archivedAt && (
                  <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">Archived</span>
                )}
              </div>
              {service.category && (
                <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                  {service.category}
                </span>
              )}
            </div>
          </div>
          {service.description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{service.description}</p>
          )}
          <div className="text-[11px] text-muted-foreground mt-2">Added {formatDate(service.createdAt)}</div>
        </div>
        <div className="text-right ml-3 min-w-[80px]">
          <div className="text-base font-bold text-foreground">{formatPrice(service.price)}</div>
          {service.rating != null && (
            <div className="text-[11px] text-warning mt-1">
              {'⭐'.repeat(Math.round(service.rating))} {service.rating.toFixed(1)}
            </div>
          )}
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => onEdit(service)}
              className="bg-transparent border border-border rounded-lg px-2.5 py-1 text-[11px] text-foreground/70 cursor-pointer hover:bg-accent"
            >
              Edit
            </button>
            {service.archivedAt ? (
              <button
                onClick={() => onUnarchive(service)}
                className="bg-transparent border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] text-emerald-600 cursor-pointer hover:bg-emerald-50"
              >
                Unarchive
              </button>
            ) : (
              <button
                onClick={() => onArchive(service)}
                className="bg-transparent border border-red-500/30 rounded-lg px-2.5 py-1 text-[11px] text-destructive cursor-pointer hover:bg-red-50"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ServiceFormModalProps {
  form: ServiceFormData;
  editingId: string | null;
  saving: boolean;
  formError: string | null;
  onFormChange: (updater: (prev: ServiceFormData) => ServiceFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ServiceFormModal({ form, editingId, saving, formError, onFormChange, onSubmit, onClose }: ServiceFormModalProps) {
  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none box-border focus:ring-2 focus:ring-primary/30';

  return (
    <div className="absolute inset-0 z-[200] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-label="Close form"
      />
      <div className="relative bg-background rounded-t-2xl p-5 max-h-[80%] overflow-y-auto">
        <h2 className="text-base font-bold text-foreground mb-4">
          {editingId ? 'Edit Service' : 'New Service'}
        </h2>

        {formError && (
          <div className="mb-3 p-2.5 rounded-lg bg-destructive/15 text-destructive text-xs">
            {formError}
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Title *</label>
          <input
            value={form.title}
            onChange={(e) => onFormChange((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Haircut, Plumbing repair"
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Category</label>
          <input
            value={form.category}
            onChange={(e) => onFormChange((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="e.g. beauty, home-repair"
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Price ($) *</label>
          <input
            value={form.price}
            onChange={(e) => onFormChange((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onFormChange((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this service includes..."
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border bg-card text-foreground/70 text-sm font-semibold cursor-pointer hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border-none bg-primary text-white text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </button>
        </div>

        <div className="h-5" />
      </div>
    </div>
  );
}

// --- Main Page ---
export default function MyServicesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { data: services = [], isLoading, isError, error } = useServices();
  const archiveMutation = useArchiveService();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((s: ServiceItem) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      category: s.category ?? '',
      price: String((s.price / 100).toFixed(2)),
      description: s.description ?? '',
    });
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    const priceCents = Math.round(Number(form.price) * 100);
    if (!form.price || isNaN(priceCents) || priceCents <= 0) {
      setFormError('A valid price is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || null,
        price: priceCents,
        description: form.description.trim() || null,
      };
      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
      } else {
        await api.post('/services', payload);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, handleCloseForm]);

  return (
    <div className="relative h-full flex flex-col bg-background">
      <StatusBar title="9:41" showNotifDot />

      {/* Header */}
      <div className="bg-background py-3.5 px-[18px] border-b border-border flex items-center gap-3">
        <div
          onClick={() => workspaceId && navigate(`/business/${workspaceId}`)}
          className="cursor-pointer flex items-center"
          role="button"
          tabIndex={0}
          aria-label="Back to business dashboard"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold text-foreground">My Services</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage service definitions</p>
        </div>
        <button
          onClick={handleAdd}
          className="cursor-pointer bg-primary rounded-xl py-2 px-3.5 text-xs font-semibold text-white flex items-center gap-1 hover:bg-primary/90"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none pb-24">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading services...</div>
        ) : isError ? (
          <div className="m-3.5 p-3.5 rounded-xl bg-destructive/15 text-destructive text-xs">
            {(error as Error)?.message ?? 'Failed to load services'}
          </div>
        ) : services.length === 0 ? (
          <ServiceListEmpty />
        ) : (
          services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={handleEdit}
              onArchive={(svc) => {
                if (confirm(`Archive "${svc.title}"?`)) {
                  archiveMutation.mutate({ id: svc.id, action: 'archive' });
                }
              }}
              onUnarchive={(svc) => {
                if (confirm(`Unarchive "${svc.title}"?`)) {
                  archiveMutation.mutate({ id: svc.id, action: 'unarchive' });
                }
              }}
            />
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ServiceFormModal
          form={form}
          editingId={editingId}
          saving={saving}
          formError={formError}
          onFormChange={setForm}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
        />
      )}

      {/* Bottom Nav */}
      <div className="absolute left-0 right-0 bottom-6 z-50">
        <BottomNav items={[...BUSINESS_NAV]} />
      </div>
    </div>
  );
}