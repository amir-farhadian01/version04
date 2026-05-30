import { useState } from 'react';
import api from '../../../lib/api.js';
import { NHCard } from '../../../components/ui/NHCard.js';
import { NHButton } from '../../../components/ui/NHButton.js';
import { NHBadge } from '../../../components/ui/NHBadge.js';
import type { OrderDraft } from '../../../services/orderDraft.js';
import { clearDraft } from '../../../services/orderDraft.js';
import { useAuthStore } from '../../../store/authStore.js';

interface ReviewStepProps {
  draft: OrderDraft;
  onUpdate: (patch: Partial<OrderDraft>) => void;
  onBack: () => void;
}

export default function ReviewStep({ draft, onUpdate, onBack }: ReviewStepProps) {
  const [budgetDollars, setBudgetDollars] = useState(
    draft.budgetCents ? (draft.budgetCents / 100).toString() : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const token = useAuthStore((s) => s.token);

  const formatDate = (isoStr?: string): string => {
    if (!isoStr) return 'Not set';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(isoStr));
    } catch {
      return isoStr;
    }
  };

  const budgetCents = (() => {
    const parsed = parseFloat(budgetDollars);
    if (isNaN(parsed) || parsed < 0) return undefined;
    return Math.round(parsed * 100);
  })();

  const handleSubmit = async () => {
    if (!token) {
      window.location.href = `/auth/login?returnTo=/order/new`;
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        categoryId: draft.categoryId,
        description: draft.description,
        scheduledDate: draft.scheduledDate,
        urgency: draft.urgency,
        status: 'published',
      };
      if (draft.serviceCatalogId) payload.serviceCatalogId = draft.serviceCatalogId;
      if (draft.address) payload.address = draft.address;
      if (budgetCents && budgetCents > 0) payload.budgetCents = budgetCents;

      const res = await api.post('/orders', payload);
      if (res.data?.data) {
        clearDraft();
        setSuccess(true);
        onUpdate({ budgetCents });
        setTimeout(() => {
          window.location.href = '/app/home';
        }, 1500);
      } else {
        setError('Failed to create order. Please try again.');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-nh-text mb-1">Review & Submit</h2>
        <p className="text-sm text-nh-text-secondary">
          Review your order details and set your budget
        </p>
      </div>

      {/* Summary Card */}
      <NHCard>
        <div className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-nh-text mb-2">
            Order Summary
          </h3>

          {/* Category */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-nh-text-muted">Category</span>
            <span className="text-sm text-nh-text">
              {draft.categoryName ?? draft.categoryId ?? 'Not selected'}
            </span>
          </div>

          {/* Description */}
          <div>
            <span className="text-xs text-nh-text-muted">Description</span>
            <p className="text-sm text-nh-text mt-1 line-clamp-3">
              {draft.description || 'No description'}
            </p>
          </div>

          {/* Photos */}
          {draft.photoUrls && draft.photoUrls.length > 0 && (
            <div>
              <span className="text-xs text-nh-text-muted">Photos</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {draft.photoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-14 h-14 rounded-lg object-cover border border-nh-border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-nh-text-muted">Address</span>
            <span className="text-sm text-nh-text">{draft.address || 'Not set'}</span>
          </div>

          {/* Date */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-nh-text-muted">Preferred Date</span>
            <span className="text-sm text-nh-text">{formatDate(draft.scheduledDate)}</span>
          </div>

          {/* Urgency */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-nh-text-muted">Urgency</span>
            {draft.urgency === 'high' ? (
              <NHBadge variant="featured" label="High Priority" />
            ) : (
              <span className="text-sm text-nh-text">Normal</span>
            )}
          </div>
        </div>
      </NHCard>

      {/* Budget */}
      <div>
        <label htmlFor="order-budget" className="block text-sm font-medium text-nh-text-secondary mb-1.5">
          Budget (CAD) <span className="text-nh-text-muted text-xs">— optional estimate</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-nh-text-muted text-sm">
            $
          </span>
          <input
            id="order-budget"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-nh-input bg-nh-surface pl-8 pr-4 py-2.5 text-sm text-nh-text placeholder:text-nh-text-muted border border-nh-border transition-all duration-200 focus:border-nh-primary focus:outline-none focus:ring-1 focus:ring-nh-primary"
            placeholder="0.00"
            value={budgetDollars}
            onChange={(e) => setBudgetDollars(e.target.value)}
          />
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="p-3 rounded-nh-card bg-nh-danger/10 border border-nh-danger/20">
          <p className="text-sm text-nh-danger">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-nh-card bg-nh-success/10 border border-nh-success/20">
          <p className="text-sm text-nh-success">Order created successfully! Redirecting...</p>
        </div>
      )}

      {/* Guest prompt */}
      {!token && (
        <div className="p-3 rounded-nh-card bg-nh-primary/10 border border-nh-primary/20">
          <p className="text-sm text-nh-text-secondary">
            You'll need to log in to submit your order. Your draft will be saved.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <NHButton variant="secondary" onClick={onBack} type="button" disabled={submitting}>
          Back
        </NHButton>
        <NHButton
          onClick={handleSubmit}
          type="button"
          className="flex-1"
          loading={submitting}
          disabled={success}
        >
          {token ? 'Submit Order' : 'Log In to Submit'}
        </NHButton>
      </div>
    </div>
  );
}