import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { StatusBar } from '../../components/ui/phone/StatusBar';
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
interface PackageMargin {
  bomCost: number;
  finalPrice: number;
  margin: number;
  marginPercent: number;
}

interface PackageItem {
  id: string;
  name: string;
  description: string | null;
  finalPrice: number;
  currency: string;
  bookingMode: string;
  isActive: boolean;
  archivedAt: string | null;
  sortOrder: number;
  margin: PackageMargin | null;
  _count: { bom: number };
  serviceCatalog: {
    id: string;
    name: string;
    category: string | null;
    lockedBookingMode: string | null;
  } | null;
}

interface ServiceCatalogOption {
  id: string;
  name: string;
  category: string | null;
}

interface PackageFormData {
  serviceCatalogId: string;
  name: string;
  finalPrice: string;
  bookingMode: string;
  description: string;
  durationMinutes: string;
}

const BOOKING_MODES = [
  'inherit_from_catalog',
  'fixed_price',
  'negotiable',
  'inventory_based',
  'auto_appointment',
] as const;

const INITIAL_FORM: PackageFormData = {
  serviceCatalogId: '',
  name: '',
  finalPrice: '',
  bookingMode: 'inherit_from_catalog',
  description: '',
  durationMinutes: '',
};

const BUSINESS_NAV = [
  { id: 'home', label: 'Home', icon: NavIcons.home },
  { id: 'social', label: 'Social', icon: NavIcons.social },
  { id: 'activity', label: 'Activity', icon: NavIcons.activity },
  { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
] as const;

// --- Hooks ---
function usePackages(workspaceId: string | undefined) {
  return useQuery<PackageItem[]>({
    queryKey: ['packages', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await api.get(`/workspaces/${workspaceId}/service-packages`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

function useServiceCatalogs() {
  return useQuery<ServiceCatalogOption[]>({
    queryKey: ['service-catalogs'],
    queryFn: async () => {
      const res = await api.get('/service-catalog');
      const data = res.data;
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];
      return (arr as Array<Record<string, unknown>>).map((c) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        category: typeof c.category === 'string' ? c.category : null,
      }));
    },
    staleTime: 60_000,
  });
}

function useArchivePackage(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'archive' | 'unarchive' }) => {
      if (!workspaceId) throw new Error('No workspace');
      await api.post(`/workspaces/${workspaceId}/service-packages/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', workspaceId] });
    },
  });
}

// --- Sub-components ---

function PackageListEmpty() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="text-5xl mb-4">📦</div>
      <div className="text-base font-semibold text-foreground mb-1">No packages yet</div>
      <div className="text-xs">Create service packages with pricing and BOM</div>
    </div>
  );
}

interface PackageCardProps {
  pkg: PackageItem;
  onEdit: (pkg: PackageItem) => void;
  onArchive: (pkg: PackageItem) => void;
  onUnarchive: (pkg: PackageItem) => void;
}

function PackageCard({ pkg, onEdit, onArchive, onUnarchive }: PackageCardProps) {
  const formatPrice = (price: number) => '$' + price.toFixed(2);

  return (
    <div
      className={`rounded-xl p-4 mx-4 mb-2.5 border border-border ${pkg.archivedAt ? 'bg-yellow-50/50 dark:bg-yellow-900/10 opacity-70' : 'bg-card'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            {pkg.name}
            {pkg.archivedAt && (
              <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">Archived</span>
            )}
          </div>
          {pkg.serviceCatalog && (
            <div className="text-[11px] text-muted-foreground mt-1">
              {pkg.serviceCatalog.name}
              {pkg.serviceCatalog.category ? ` · ${pkg.serviceCatalog.category}` : ''}
            </div>
          )}
          {pkg.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{pkg.description}</p>
          )}
        </div>
        <div className="text-right ml-3 min-w-[80px]">
          <div className="text-lg font-bold text-foreground">{formatPrice(pkg.finalPrice)}</div>
          <div className="text-[10px] text-muted-foreground capitalize mt-0.5">
            {pkg.bookingMode.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* BOM info */}
      <div className="flex gap-2 flex-wrap mb-2">
        <div className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
          {pkg._count.bom} BOM items
        </div>
        {pkg.margin && (
          <div
            className={`text-[10px] px-2 py-0.5 rounded-md ${pkg.margin.margin >= 0 ? 'text-emerald-600 bg-emerald-500/10' : 'text-destructive bg-destructive/10'}`}
          >
            Margin: {pkg.margin.marginPercent.toFixed(0)}%
          </div>
        )}
        <div className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
          {pkg.isActive ? 'Active' : 'Inactive'}
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => onEdit(pkg)}
          className="bg-transparent border border-border rounded-lg px-2.5 py-1 text-[11px] text-foreground/70 cursor-pointer hover:bg-accent"
        >
          Edit
        </button>
        {pkg.archivedAt ? (
          <button
            onClick={() => onUnarchive(pkg)}
            className="bg-transparent border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] text-emerald-600 cursor-pointer hover:bg-emerald-50"
          >
            Unarchive
          </button>
        ) : (
          <button
            onClick={() => onArchive(pkg)}
            className="bg-transparent border border-warning/30 rounded-lg px-2.5 py-1 text-[11px] text-warning cursor-pointer hover:bg-warning/10"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

interface PackageFormModalProps {
  form: PackageFormData;
  editingId: string | null;
  catalogs: ServiceCatalogOption[];
  saving: boolean;
  formError: string | null;
  onFormChange: (updater: (prev: PackageFormData) => PackageFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function PackageFormModal({
  form,
  editingId,
  catalogs,
  saving,
  formError,
  onFormChange,
  onSubmit,
  onClose,
}: PackageFormModalProps) {
  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none box-border focus:ring-2 focus:ring-primary/30';

  return (
    <div className="absolute inset-0 z-[200] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-label="Close form"
      />
      <div className="relative bg-background rounded-t-2xl p-5 max-h-[85%] overflow-y-auto">
        <h2 className="text-base font-bold text-foreground mb-4">
          {editingId ? 'Edit Package' : 'New Package'}
        </h2>

        {formError && (
          <div className="mb-3 p-2.5 rounded-lg bg-destructive/15 text-destructive text-xs">{formError}</div>
        )}

        {!editingId && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Service Catalog *</label>
            <select
              value={form.serviceCatalogId}
              onChange={(e) => onFormChange((prev) => ({ ...prev, serviceCatalogId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select a service catalog...</option>
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.category ? ` (${c.category})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Package Name *</label>
          <input
            value={form.name}
            onChange={(e) => onFormChange((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Basic Haircut, Standard Wash"
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Price ($) *</label>
          <input
            value={form.finalPrice}
            onChange={(e) => onFormChange((prev) => ({ ...prev, finalPrice: e.target.value }))}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Booking Mode</label>
          <select
            value={form.bookingMode}
            onChange={(e) => onFormChange((prev) => ({ ...prev, bookingMode: e.target.value }))}
            className={inputClass}
          >
            {BOOKING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onFormChange((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe this package..."
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
export default function MyPackagesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { data: packages = [], isLoading, isError, error } = usePackages(workspaceId);
  const { data: catalogs = [] } = useServiceCatalogs();
  const archiveMutation = useArchivePackage(workspaceId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((pkg: PackageItem) => {
    setEditingId(pkg.id);
    setForm({
      serviceCatalogId: pkg.serviceCatalog?.id ?? '',
      name: pkg.name,
      finalPrice: String(pkg.finalPrice),
      bookingMode: pkg.bookingMode,
      description: pkg.description ?? '',
      durationMinutes: '',
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
    if (!workspaceId) return;
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    const price = Number(form.finalPrice);
    if (!form.finalPrice || isNaN(price) || price < 0) {
      setFormError('A valid price >= 0 is required');
      return;
    }
    if (!editingId && !form.serviceCatalogId) {
      setFormError('Service catalog is required');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        finalPrice: price,
        bookingMode: form.bookingMode,
        description: form.description.trim() || null,
      };
      if (editingId) {
        await api.put(`/workspaces/${workspaceId}/service-packages/${editingId}`, payload);
      } else {
        payload.serviceCatalogId = form.serviceCatalogId;
        if (form.durationMinutes) {
          payload.durationMinutes = Number(form.durationMinutes);
        }
        await api.post(`/workspaces/${workspaceId}/service-packages`, payload);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, handleCloseForm, workspaceId]);

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
          <h1 className="font-display text-lg font-bold text-foreground">Packages</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Service packages & pricing</p>
        </div>
        <button
          onClick={() => workspaceId && navigate(`/business/${workspaceId}/inventory`)}
          className="cursor-pointer bg-card rounded-xl py-2 px-3.5 text-xs font-semibold text-foreground/70 border border-border hover:bg-accent mr-2"
        >
          Inventory →
        </button>
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
          <div className="text-center py-12 text-muted-foreground text-sm">Loading packages...</div>
        ) : isError ? (
          <div className="m-3.5 p-3.5 rounded-xl bg-destructive/15 text-destructive text-xs">
            {(error as Error)?.message ?? 'Failed to load packages'}
          </div>
        ) : packages.length === 0 ? (
          <PackageListEmpty />
        ) : (
          packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={handleEdit}
              onArchive={(p) => {
                const action = p.archivedAt ? 'unarchive' : 'archive';
                if (confirm(`${action === 'archive' ? 'Archive' : 'Unarchive'} "${p.name}"?`)) {
                  archiveMutation.mutate({ id: p.id, action });
                }
              }}
              onUnarchive={(p) => {
                if (confirm(`Unarchive "${p.name}"?`)) {
                  archiveMutation.mutate({ id: p.id, action: 'unarchive' });
                }
              }}
            />
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <PackageFormModal
          form={form}
          editingId={editingId}
          catalogs={catalogs}
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