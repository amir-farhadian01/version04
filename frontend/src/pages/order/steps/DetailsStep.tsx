import { useEffect, useState, useRef } from 'react';
import api from '../../../lib/api.js';
import { NHCard } from '../../../components/ui/NHCard.js';
import { NHButton } from '../../../components/ui/NHButton.js';
import { NHInput } from '../../../components/ui/NHInput.js';
import type { OrderDraft } from '../../../services/orderDraft.js';

interface QuestionnaireField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
}

interface DetailsStepProps {
  draft: OrderDraft;
  onUpdate: (patch: Partial<OrderDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

const MIN_DESC_LENGTH = 20;
const MAX_PHOTOS = 5;

export default function DetailsStep({ draft, onUpdate, onNext, onBack }: DetailsStepProps) {
  const [description, setDescription] = useState(draft.description ?? '');
  const [photos, setPhotos] = useState<string[]>(draft.photoUrls ?? []);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireField[]>([]);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const descLength = description.trim().length;
  const descError = description.length > 0 && descLength < MIN_DESC_LENGTH
    ? `Description must be at least ${MIN_DESC_LENGTH} characters (${descLength}/${MIN_DESC_LENGTH})`
    : undefined;

  const hasPreselection = !!(draft.serviceId || draft.packageId);

  useEffect(() => {
    if (!draft.serviceCatalogId && !draft.serviceId) return;
    const catalogId = draft.serviceCatalogId ?? draft.serviceId;
    if (!catalogId) return;

    let cancelled = false;
    async function fetchQuestionnaire() {
      setQuestionnaireLoading(true);
      try {
        const res = await api.get<{ schema?: { properties?: Record<string, { type: string; title?: string; description?: string }>; required?: string[] }; fields?: QuestionnaireField[] }>(
          `/service-catalog/${catalogId}/schema`,
        );
        if (!cancelled) {
          // Support both raw schema format and fields array
          const schema = res.data;
          if (schema?.fields) {
            setQuestionnaire(schema.fields);
          } else if (schema?.schema?.properties) {
            const requiredFields = new Set(schema.schema.required ?? []);
            const fields: QuestionnaireField[] = Object.entries(schema.schema.properties).map(([key, prop]) => ({
              id: key,
              label: prop.title ?? prop.description ?? key,
              type: prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text',
              required: requiredFields.has(key),
            }));
            setQuestionnaire(fields);
          } else {
            setQuestionnaire([]);
          }
        }
      } catch {
        // questionnaire is optional
      } finally {
        if (!cancelled) setQuestionnaireLoading(false);
      }
    }
    fetchQuestionnaire();
    return () => {
      cancelled = true;
    };
  }, [draft.serviceCatalogId, draft.serviceId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);

    const newUrls: string[] = [];

    for (const file of toUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post<{ data: { url: string } }>('/uploads/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res.data?.data?.url;
        if (url) newUrls.push(url);
      } catch {
        // skip failed uploads
      }
    }

    setPhotos((prev) => [...prev, ...newUrls].slice(0, MAX_PHOTOS));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (description.trim().length < MIN_DESC_LENGTH) {
      errors.description = `Description must be at least ${MIN_DESC_LENGTH} characters`;
    }
    for (const field of questionnaire) {
      if (field.required) {
        const val = draft[field.id as keyof OrderDraft];
        if (!val || (typeof val === 'string' && val.trim().length === 0)) {
          errors[field.id] = `${field.label} is required`;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    onUpdate({ description: description.trim(), photoUrls: photos });
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-nh-text mb-1">Service Details</h2>
        <p className="text-sm text-nh-text-secondary">
          Describe your service need and attach relevant photos
        </p>
      </div>

      {/* Service/package info card when preselected */}
      {hasPreselection && (
        <NHCard>
          <div className="p-4 flex items-start gap-3">
            <span className="text-xl mt-0.5">{draft.packageId ? '📦' : '📋'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-nh-text-muted uppercase tracking-wide">
                {draft.packageId ? 'Selected Package' : 'Selected Service'}
              </div>
              <div className="text-sm font-semibold text-nh-text">
                {draft.packageName ?? draft.serviceName ?? '—'}
              </div>
              {draft.packageId && draft.serviceName && (
                <div className="text-xs text-nh-text-secondary mt-0.5">
                  Category: {draft.serviceName}
                </div>
              )}
              {draft.categoryName && (
                <div className="text-xs text-nh-text-secondary mt-0.5">
                  {draft.categoryName}
                </div>
              )}
            </div>
          </div>
        </NHCard>
      )}

      {/* Description */}
      <div>
        <label htmlFor="order-desc" className="block text-sm font-medium text-nh-text-secondary mb-1.5">
          Description <span className="text-nh-danger">*</span>
        </label>
        <textarea
          id="order-desc"
          className="w-full rounded-nh-input bg-nh-surface px-4 py-3 text-sm text-nh-text placeholder:text-nh-text-muted border border-nh-border transition-all duration-200 focus:border-nh-primary focus:outline-none focus:ring-1 focus:ring-nh-primary min-h-[100px] resize-y"
          placeholder={draft.serviceName
            ? `Describe your specific needs for "${draft.serviceName}" (e.g., size, scope, timeline)`
            : "Describe the service you need in detail (e.g., 'Need a living room painted, walls only, approx 250 sq ft')"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
        <div className="flex justify-between mt-1">
          {descError ? (
            <p className="text-xs text-nh-danger">{descError}</p>
          ) : (
            <span />
          )}
          <span className={`text-xs ${descLength >= MIN_DESC_LENGTH ? 'text-nh-success' : 'text-nh-text-muted'}`}>
            {descLength}/{MIN_DESC_LENGTH} min
          </span>
        </div>
        {formErrors.description && (
          <p className="text-xs text-nh-danger mt-1">{formErrors.description}</p>
        )}
      </div>

      {/* Photo Upload */}
      <div>
        <p className="text-sm font-medium text-nh-text-secondary mb-2">
          Photos <span className="text-nh-text-muted text-xs">(up to {MAX_PHOTOS})</span>
        </p>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {photos.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-nh-border">
                <img src={url} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
            />
            <NHButton
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              type="button"
            >
              {uploading ? 'Uploading...' : 'Add Photos'}
            </NHButton>
          </>
        )}
      </div>

      {/* Dynamic Questionnaire */}
      {questionnaireLoading && (
        <NHCard>
          <div className="p-4 flex items-center justify-center">
            <div className="animate-spin h-5 w-5 border-2 border-nh-primary border-t-transparent rounded-full" />
          </div>
        </NHCard>
      )}
      {questionnaire.length > 0 && (
        <NHCard>
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-nh-text-secondary">Additional Details</p>
            {questionnaire.map((field) => (
              <NHInput
                key={field.id}
                label={field.label}
                error={formErrors[field.id]}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                type={field.type === 'number' ? 'number' : 'text'}
                onChange={(e) => onUpdate({ [field.id]: e.target.value } as Partial<OrderDraft>)}
              />
            ))}
          </div>
        </NHCard>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <NHButton variant="secondary" onClick={onBack} type="button">
          Back
        </NHButton>
        <NHButton onClick={handleNext} type="button" className="flex-1">
          Continue
        </NHButton>
      </div>
    </div>
  );
}
