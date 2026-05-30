import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { StatusBar } from '../../components/ui/phone/StatusBar';
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  stockQuantity: number | null;
  isActive: boolean;
  archivedAt: string | null;
  sortOrder: number;
  _count: { bomLines: number };
}

interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  category: string;
  unit: string;
  unitPrice: string;
  stockQuantity: string;
}

const INITIAL_FORM: ProductFormData = {
  name: '',
  sku: '',
  description: '',
  category: '',
  unit: 'each',
  unitPrice: '',
  stockQuantity: '',
};

const UNIT_OPTIONS = ['each', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'hour', 'day', 'box', 'pack', 'pair', 'set'] as const;

const BUSINESS_NAV = [
  { id: 'home', label: 'Home', icon: NavIcons.home },
  { id: 'social', label: 'Social', icon: NavIcons.social },
  { id: 'activity', label: 'Activity', icon: NavIcons.activity },
  { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
] as const;

// --- Hooks ---
function useProducts(workspaceId: string | undefined) {
  return useQuery<ProductItem[]>({
    queryKey: ['products', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await api.get(`/workspaces/${workspaceId}/products`);
      return Array.isArray(res.data?.items) ? res.data.items : [];
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

function useArchiveProduct(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'archive' | 'unarchive' }) => {
      if (!workspaceId) throw new Error('No workspace');
      await api.post(`/workspaces/${workspaceId}/products/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', workspaceId] });
    },
  });
}

// --- Sub-components ---

function ProductListEmpty() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="text-5xl mb-4">📦</div>
      <div className="text-base font-semibold text-foreground mb-1">No products yet</div>
      <div className="text-xs">Add products to your inventory to use in package BOMs</div>
    </div>
  );
}

interface ProductCardProps {
  product: ProductItem;
  onEdit: (p: ProductItem) => void;
  onArchive: (p: ProductItem) => void;
  onUnarchive: (p: ProductItem) => void;
}

function ProductCard({ product, onEdit, onArchive, onUnarchive }: ProductCardProps) {
  const formatPrice = (price: number) => '$' + price.toFixed(2);
  const stockColor =
    product.stockQuantity != null && product.stockQuantity <= 5
      ? 'text-destructive'
      : product.stockQuantity != null && product.stockQuantity <= 20
        ? 'text-warning'
        : 'text-emerald-600';

  return (
    <div
      className={`rounded-xl p-4 mx-4 mb-2.5 border border-border ${product.archivedAt ? 'bg-yellow-50/50 dark:bg-yellow-900/10 opacity-70' : 'bg-card'}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            {product.name}
            {product.archivedAt && (
              <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">Archived</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap mt-1 items-center">
            {product.sku && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">SKU: {product.sku}</span>
            )}
            {product.category && (
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{product.category}</span>
            )}
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {product._count.bomLines} BOM uses
            </span>
          </div>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{product.description}</p>
          )}
        </div>
        <div className="text-right ml-3 min-w-[80px]">
          <div className="text-base font-bold text-foreground">{formatPrice(product.unitPrice)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">/ {product.unit}</div>
          <div className={`text-[11px] font-semibold mt-2 ${stockColor}`}>
            {product.stockQuantity != null ? `Stock: ${product.stockQuantity}` : 'No stock set'}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-2.5">
        <button
          onClick={() => onEdit(product)}
          className="bg-transparent border border-border rounded-lg px-2.5 py-1 text-[11px] text-foreground/70 cursor-pointer hover:bg-accent"
        >
          Edit
        </button>
        {product.archivedAt ? (
          <button
            onClick={() => onUnarchive(product)}
            className="bg-transparent border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[11px] text-emerald-600 cursor-pointer hover:bg-emerald-50"
          >
            Unarchive
          </button>
        ) : (
          <button
            onClick={() => onArchive(product)}
            className="bg-transparent border border-warning/30 rounded-lg px-2.5 py-1 text-[11px] text-warning cursor-pointer hover:bg-warning/10"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

interface ProductFormModalProps {
  form: ProductFormData;
  editingId: string | null;
  saving: boolean;
  formError: string | null;
  onFormChange: (updater: (prev: ProductFormData) => ProductFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ProductFormModal({ form, editingId, saving, formError, onFormChange, onSubmit, onClose }: ProductFormModalProps) {
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
          {editingId ? 'Edit Product' : 'New Product'}
        </h2>

        {formError && (
          <div className="mb-3 p-2.5 rounded-lg bg-destructive/15 text-destructive text-xs">{formError}</div>
        )}

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Name *</label>
          <input
            value={form.name}
            onChange={(e) => onFormChange((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Engine Oil, Brake Pads"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => onFormChange((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder="e.g. OIL-5W30"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Category</label>
            <input
              value={form.category}
              onChange={(e) => onFormChange((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. parts, supplies"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Unit Price ($) *</label>
            <input
              value={form.unitPrice}
              onChange={(e) => onFormChange((prev) => ({ ...prev, unitPrice: e.target.value }))}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Unit</label>
            <select
              value={form.unit}
              onChange={(e) => onFormChange((prev) => ({ ...prev, unit: e.target.value }))}
              className={inputClass}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Stock Quantity</label>
          <input
            value={form.stockQuantity}
            onChange={(e) => onFormChange((prev) => ({ ...prev, stockQuantity: e.target.value }))}
            placeholder="Leave empty if not tracking"
            type="number"
            min="0"
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onFormChange((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe this product..."
            rows={2}
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
export default function InventoryPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { data: products = [], isLoading, isError, error } = useProducts(workspaceId);
  const archiveMutation = useArchiveProduct(workspaceId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((p: ProductItem) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      description: p.description ?? '',
      category: p.category ?? '',
      unit: p.unit,
      unitPrice: String(p.unitPrice),
      stockQuantity: p.stockQuantity != null ? String(p.stockQuantity) : '',
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
    const price = Number(form.unitPrice);
    if (!form.unitPrice || isNaN(price) || price < 0) {
      setFormError('A valid unit price >= 0 is required');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        unit: form.unit,
        unitPrice: price,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : null,
      };
      if (form.sku.trim()) payload.sku = form.sku.trim();
      if (editingId) {
        await api.put(`/workspaces/${workspaceId}/products/${editingId}`, payload);
      } else {
        await api.post(`/workspaces/${workspaceId}/products`, payload);
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
          <h1 className="font-display text-lg font-bold text-foreground">Inventory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Products, parts & materials</p>
        </div>
        <button
          onClick={() => workspaceId && navigate(`/business/${workspaceId}/packages`)}
          className="cursor-pointer bg-card rounded-xl py-2 px-3.5 text-xs font-semibold text-foreground/70 border border-border hover:bg-accent mr-2"
        >
          Packages →
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
          <div className="text-center py-12 text-muted-foreground text-sm">Loading inventory...</div>
        ) : isError ? (
          <div className="m-3.5 p-3.5 rounded-xl bg-destructive/15 text-destructive text-xs">
            {(error as Error)?.message ?? 'Failed to load products'}
          </div>
        ) : products.length === 0 ? (
          <ProductListEmpty />
        ) : (
          products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={handleEdit}
              onArchive={(prod) => {
                if (confirm(`Archive "${prod.name}"?`)) {
                  archiveMutation.mutate({ id: prod.id, action: 'archive' });
                }
              }}
              onUnarchive={(prod) => {
                if (confirm(`Unarchive "${prod.name}"?`)) {
                  archiveMutation.mutate({ id: prod.id, action: 'unarchive' });
                }
              }}
            />
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ProductFormModal
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