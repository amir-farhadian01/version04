import { useState } from 'react';
import { NHButton } from '../../../components/ui/NHButton.js';
import type { OrderDraft } from '../../../services/orderDraft.js';

interface LocationStepProps {
  draft: OrderDraft;
  onUpdate: (patch: Partial<OrderDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

const URGENCY_OPTIONS = [
  { value: 'normal' as const, label: 'Normal', desc: 'Flexible scheduling' },
  { value: 'high' as const, label: 'High Priority', desc: 'Need it sooner' },
];

export default function LocationStep({ draft, onUpdate, onNext, onBack }: LocationStepProps) {
  const [address, setAddress] = useState(draft.address ?? '');
  const [scheduledDate, setScheduledDate] = useState(draft.scheduledDate ?? '');
  const [urgency, setUrgency] = useState<'normal' | 'high'>(draft.urgency ?? 'normal');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get minimum date as today in YYYY-MM-DDTHH:mm format
  const now = new Date();
  const minDate = now.toISOString().slice(0, 16);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (address.trim().length < 5) {
      errs.address = 'Please enter a valid address (at least 5 characters)';
    }
    if (!scheduledDate) {
      errs.scheduledDate = 'Please select a preferred date and time';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    onUpdate({
      address: address.trim(),
      scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
      urgency,
    });
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-nh-text mb-1">Location & Schedule</h2>
        <p className="text-sm text-nh-text-secondary">
          Where and when do you need the service?
        </p>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="order-address" className="block text-sm font-medium text-nh-text-secondary mb-1.5">
          Service Address <span className="text-nh-danger">*</span>
        </label>
        <input
          id="order-address"
          type="text"
          className="w-full rounded-nh-input bg-nh-surface px-4 py-2.5 text-sm text-nh-text placeholder:text-nh-text-muted border border-nh-border transition-all duration-200 focus:border-nh-primary focus:outline-none focus:ring-1 focus:ring-nh-primary"
          placeholder="123 Main St, Toronto, ON M5V 1A1"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        {errors.address && (
          <p className="text-xs text-nh-danger mt-1">{errors.address}</p>
        )}
      </div>

      {/* Date/Time Picker */}
      <div>
        <label htmlFor="order-date" className="block text-sm font-medium text-nh-text-secondary mb-1.5">
          Preferred Date & Time <span className="text-nh-danger">*</span>
        </label>
        <input
          id="order-date"
          type="datetime-local"
          className="w-full rounded-nh-input bg-nh-surface px-4 py-2.5 text-sm text-nh-text placeholder:text-nh-text-muted border border-nh-border transition-all duration-200 focus:border-nh-primary focus:outline-none focus:ring-1 focus:ring-nh-primary"
          value={scheduledDate}
          min={minDate}
          onChange={(e) => setScheduledDate(e.target.value)}
        />
        {errors.scheduledDate && (
          <p className="text-xs text-nh-danger mt-1">{errors.scheduledDate}</p>
        )}
      </div>

      {/* Urgency */}
      <div>
        <p className="block text-sm font-medium text-nh-text-secondary mb-2">Urgency</p>
        <div className="grid grid-cols-2 gap-3">
          {URGENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUrgency(opt.value)}
              className={`p-3 rounded-nh-card border text-left transition-all ${
                urgency === opt.value
                  ? 'border-nh-primary bg-nh-primary/10 text-nh-text'
                  : 'border-nh-border bg-nh-surface text-nh-text-secondary hover:border-nh-primary/30'
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

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