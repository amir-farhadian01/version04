import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NHCard } from '../../components/ui/NHCard.js';
import type { OrderDraft } from '../../services/orderDraft.js';
import { loadDraft, saveDraftLocally, startAutoSave } from '../../services/orderDraft.js';
import CategoryStep from './steps/CategoryStep.js';
import DetailsStep from './steps/DetailsStep.js';
import LocationStep from './steps/LocationStep.js';
import ReviewStep from './steps/ReviewStep.js';

const TOTAL_STEPS = 4;

const STEP_LABELS = [
  { step: 1, label: 'Category' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Location' },
  { step: 4, label: 'Review' },
] as const;

interface PreselectedInfo {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  businessId?: string;
  businessName?: string;
  price?: number;
  description?: string;
  bookingMode?: string;
}

export default function OrderWizard() {
  const [searchParams] = useSearchParams();
  const preselectedServiceId = searchParams.get('serviceId') ?? undefined;
  const preselectedPackageId = searchParams.get('packageId') ?? undefined;
  const preselectedBusinessId = searchParams.get('businessId') ?? undefined;

  const [preselectedInfo, setPreselectedInfo] = useState<PreselectedInfo | null>(null);
  const [preselectedLoading, setPreselectedLoading] = useState<boolean>(
    !!(preselectedServiceId || preselectedPackageId),
  );
  const [draft, setDraft] = useState<OrderDraft>(() => {
    const saved = loadDraft();
    const base = saved ?? { step: 1, updatedAt: new Date().toISOString() };
    if (preselectedServiceId) base.serviceId = preselectedServiceId;
    if (preselectedPackageId) base.packageId = preselectedPackageId;
    if (preselectedBusinessId) base.businessId = preselectedBusinessId;
    return base;
  });
  const [currentStep, setCurrentStep] = useState<number>(draft.step);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saved' | 'saving'>('idle');
  const draftRef = useRef(draft);

  // Keep ref in sync
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const updateDraft = useCallback((patch: Partial<OrderDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveDraftLocally(next);
      return next;
    });
  }, []);

  // Fetch preselected service info by serviceId
  useEffect(() => {
    if (!preselectedServiceId) return;

    let cancelled = false;
    async function fetchService() {
      setPreselectedLoading(true);
      try {
        const res = await fetch(`/api/service-catalog/${preselectedServiceId}`);
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json() as { id: string; name: string; price?: number; description?: string };
          if (json?.id) {
            const categoryRes = await fetch(`/api/service-catalog/${preselectedServiceId}/schema`);
            let categoryId: string | undefined;
            let categoryName: string | undefined;
            if (categoryRes.ok) {
              const catJson = await categoryRes.json() as { serviceCatalog?: { id: string; name?: string }; breadcrumbs?: { id: string; name: string }[] };
              categoryId = catJson?.serviceCatalog?.id;
              categoryName = catJson?.breadcrumbs?.map((b) => b.name).join(' › ');
            }

            setPreselectedInfo({
              id: json.id,
              name: json.name,
              categoryId,
              categoryName,
              price: json.price,
              description: json.description,
            });
            updateDraft({
              serviceId: json.id,
              serviceCatalogId: json.id,
              serviceName: json.name,
              ...(categoryId ? { categoryId } : {}),
              ...(categoryName ? { categoryName } : {}),
            });
          }
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (!cancelled) setPreselectedLoading(false);
      }
    }
    fetchService();
    return () => { cancelled = true; };
  }, [preselectedServiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch preselected package info by packageId
  useEffect(() => {
    if (!preselectedPackageId) return;

    let cancelled = false;
    async function fetchPackage() {
      setPreselectedLoading(true);
      try {
        const res = await fetch(`/api/service-catalog/package/${preselectedPackageId}`);
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json() as { data?: { id: string; name: string; description?: string; price?: number; categoryId?: string; categoryName?: string; serviceId?: string; serviceName?: string; businessId?: string; businessName?: string; bookingMode?: string } };
          const pkg = json?.data;
          if (pkg?.id) {
            setPreselectedInfo({
              id: pkg.id,
              name: pkg.name,
              categoryId: pkg.categoryId,
              categoryName: pkg.categoryName,
              businessId: pkg.businessId,
              businessName: pkg.businessName,
              price: pkg.price,
              description: pkg.description,
              bookingMode: pkg.bookingMode,
            });
            updateDraft({
              packageId: pkg.id,
              packageName: pkg.name,
              serviceId: pkg.serviceId,
              serviceCatalogId: pkg.serviceId,
              serviceName: pkg.serviceName,
              ...(pkg.categoryId ? { categoryId: pkg.categoryId } : {}),
              ...(pkg.categoryName ? { categoryName: pkg.categoryName } : {}),
              ...(pkg.businessId ? { businessId: pkg.businessId } : {}),
              ...(pkg.price ? { budgetCents: pkg.price } : {}),
            });
          }
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (!cancelled) setPreselectedLoading(false);
      }
    }
    fetchPackage();
    return () => { cancelled = true; };
  }, [preselectedPackageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance past CategoryStep if service/package already selected
  useEffect(() => {
    if (currentStep === 1 && !preselectedLoading && (draft.serviceId || draft.packageId)) {
      setCurrentStep(2);
      updateDraft({ step: 2 });
    }
  }, [currentStep, preselectedLoading, draft.serviceId, draft.packageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save timer
  useEffect(() => {
    const cleanup = startAutoSave(
      () => ({ ...draftRef.current, step: currentStep }),
      () => {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      },
    );
    return cleanup;
  }, [currentStep]);

  const goToStep = (step: number) => {
    const nextStep = Math.max(1, Math.min(TOTAL_STEPS, step));
    setCurrentStep(nextStep);
    updateDraft({ step: nextStep });
  };

  const handleNext = () => goToStep(currentStep + 1);
  const handleBack = () => goToStep(currentStep - 1);

  return (
    <div className="min-h-screen bg-nh-bg">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-nh-text">New Service Order</h1>
          <p className="text-sm text-nh-text-secondary mt-1">
            Tell us what you need and we'll find the right provider
          </p>
        </div>

        {/* Loading state for preselected fetch */}
        {preselectedLoading && (
          <div className="mb-4 bg-nh-surface border border-nh-border rounded-lg p-8 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-nh-primary border-t-transparent rounded-full" />
            <span className="ml-3 text-sm text-nh-text-secondary">Loading service details...</span>
          </div>
        )}

        {/* Preselected service/package banner */}
        {preselectedInfo && !preselectedLoading && (
          <div className="mb-4 bg-nh-primary/10 border border-nh-primary/30 rounded-lg p-3 flex items-center gap-3">
            <span className="text-lg">{draft.packageId ? '📦' : '📋'}</span>
            <div className="flex-1">
              <div className="text-xs text-nh-text-muted">
                {draft.packageId ? 'Selected package' : 'Requesting service'}
              </div>
              <div className="text-sm font-semibold text-nh-text">
                {preselectedInfo.name}
                {draft.packageId && draft.serviceName && (
                  <span className="text-xs font-normal text-nh-text-secondary ml-1">
                    — {draft.serviceName}
                  </span>
                )}
              </div>
              {preselectedInfo.categoryName && (
                <div className="text-xs text-nh-text-secondary">{preselectedInfo.categoryName}</div>
              )}
              {preselectedInfo.businessName && (
                <div className="text-xs text-nh-text-secondary">by {preselectedInfo.businessName}</div>
              )}
              {preselectedInfo.price !== undefined && preselectedInfo.price > 0 && (
                <div className="text-xs font-medium text-nh-primary mt-0.5">
                  ${(preselectedInfo.price / 100).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <NHCard className="mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              {STEP_LABELS.map((s, i) => (
                <div key={s.step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                      currentStep === s.step
                        ? 'bg-nh-primary text-white scale-110'
                        : currentStep > s.step
                          ? 'bg-nh-success text-white'
                          : 'bg-nh-surface text-nh-text-muted border border-nh-border'
                    }`}
                  >
                    {currentStep > s.step ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    ) : (
                      s.step
                    )}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className={`hidden sm:block w-8 h-0.5 mx-1 ${
                        currentStep > s.step ? 'bg-nh-success' : 'bg-nh-border'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-nh-text-muted text-center">
              Step {currentStep} of {TOTAL_STEPS}: {STEP_LABELS[currentStep - 1].label}
            </p>
          </div>
        </NHCard>

        {/* Auto-save indicator */}
        {autoSaveStatus !== 'idle' && (
          <div className="mb-4 flex items-center justify-end gap-2 text-xs text-nh-success">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            Draft saved
          </div>
        )}

        {/* Step Content */}
        {currentStep === 1 && (
          <CategoryStep draft={draft} onUpdate={updateDraft} onNext={handleNext} />
        )}
        {currentStep === 2 && (
          <DetailsStep
            draft={draft}
            onUpdate={updateDraft}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <LocationStep draft={draft} onUpdate={updateDraft} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 4 && (
          <ReviewStep draft={draft} onUpdate={updateDraft} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}