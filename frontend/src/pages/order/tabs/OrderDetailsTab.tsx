import { NHCard } from '../../../components/ui/NHCard.js';
import { cn } from '../../../lib/cn.js';
import type { OrderDetailData } from '../../../services/orders.js';

const STATUS_TIMELINE: Record<string, { label: string; order: number }> = {
  draft: { label: 'Draft created', order: 0 },
  submitted: { label: 'Order submitted', order: 1 },
  matching: { label: 'Finding providers', order: 2 },
  matched: { label: 'Provider matched', order: 3 },
  contracted: { label: 'Contract approved', order: 4 },
  paid: { label: 'Payment received', order: 5 },
  in_progress: { label: 'Job in progress', order: 6 },
  completed: { label: 'Job completed', order: 7 },
  closed: { label: 'Closed', order: 8 },
};

function getTimelineStep(activeStatus: string): number {
  return STATUS_TIMELINE[activeStatus]?.order ?? -1;
}

interface Props {
  order: OrderDetailData;
}

export default function OrderDetailsTab({ order }: Props) {
  const activeStep = getTimelineStep(order.status);
  const timelineSteps = Object.entries(STATUS_TIMELINE)
    .filter(([, v]) => v.order <= Math.max(activeStep, 0))
    .sort(([, a], [, b]) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Description */}
      <NHCard className="p-4">
        <h3 className="text-sm font-semibold text-nh-muted mb-2">Description</h3>
        <p className="text-nh-text text-sm whitespace-pre-wrap">{order.description}</p>
        {order.descriptionAiAssisted && (
          <span className="inline-block mt-2 text-xs text-nh-primary/70 italic">
            AI-assisted description
          </span>
        )}
      </NHCard>

      {/* Status Timeline */}
      <NHCard className="p-4">
        <h3 className="text-sm font-semibold text-nh-muted mb-4">Status Timeline</h3>
        <div className="relative">
          {timelineSteps.map(([status, info], idx) => {
            const isComplete = info.order <= activeStep;
            const isCurrent = info.order === activeStep;
            const isCancelled = order.status === 'cancelled' && info.order >= activeStep;
            return (
              <div key={status} className="flex items-start gap-3 pb-4 last:pb-0">
                {/* Line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full border-2 shrink-0 mt-1',
                      isCancelled
                        ? 'border-red-400 bg-transparent'
                        : isComplete
                          ? 'border-nh-primary bg-nh-primary'
                          : 'border-nh-border bg-transparent',
                    )}
                  />
                  {idx < timelineSteps.length - 1 && (
                    <div
                      className={cn(
                        'w-0.5 h-full min-h-[24px]',
                        isComplete ? 'bg-nh-primary' : 'bg-nh-border',
                      )}
                    />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCancelled ? 'text-red-400 line-through' : isCurrent ? 'text-nh-text' : 'text-nh-muted',
                    )}
                  >
                    {info.label}
                  </p>
                  {isCurrent && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-nh-primary/10 text-nh-primary">
                      Current
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {order.status === 'cancelled' && order.cancelReason && (
          <div className="mt-3 p-3 rounded-md bg-red-400/10 border border-red-400/20">
            <p className="text-xs text-red-400 font-medium">Cancellation Reason</p>
            <p className="text-sm text-nh-text mt-1">{order.cancelReason}</p>
          </div>
        )}
      </NHCard>

      {/* Payment Info */}
      {order.payment && (
        <NHCard className="p-4">
          <h3 className="text-sm font-semibold text-nh-muted mb-3">Payment</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-nh-text">
                {order.matchedSummary?.package.currency ?? 'CAD'}{' '}
                {(order.payment.amount / 100).toFixed(2)}
              </p>
              <p className="text-xs text-nh-muted">Amount</p>
            </div>
            <div>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  order.payment.status === 'CAPTURED'
                    ? 'bg-green-400/10 text-green-400'
                    : order.payment.status === 'REFUNDED'
                      ? 'bg-amber-400/10 text-amber-400'
                      : 'bg-nh-muted/10 text-nh-muted',
                )}
              >
                {order.payment.status}
              </span>
              <p className="text-xs text-nh-muted mt-1">Status</p>
            </div>
          </div>
          {order.payment.escrowReleaseAt && (
            <p className="text-xs text-nh-muted mt-2">
              Escrow release: {new Date(order.payment.escrowReleaseAt).toLocaleString()}
            </p>
          )}
        </NHCard>
      )}

      {/* Order Info */}
      <NHCard className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-nh-muted mb-2">Order Info</h3>
        <InfoRow label="Status" value={order.status} />
        <InfoRow label="Urgency" value={order.urgency} />
        <InfoRow label="Address" value={order.address} />
        {order.scheduledAt && (
          <InfoRow
            label="Scheduled"
            value={new Date(order.scheduledAt).toLocaleString()}
          />
        )}
        <InfoRow label="Schedule Flexibility" value={order.scheduleFlexibility} />
        {order.budget != null && (
          <InfoRow label="Budget" value={`${order.matchedSummary?.package.currency ?? 'CAD'} ${(order.budget / 100).toFixed(2)}`} />
        )}
        {order.budgetMin != null && order.budgetMax != null && (
          <InfoRow
            label="Budget Range"
            value={`${order.matchedSummary?.package.currency ?? 'CAD'} ${(order.budgetMin / 100).toFixed(2)} - ${(order.budgetMax / 100).toFixed(2)}`}
          />
        )}
        <InfoRow label="Order ID" value={order.id} mono />
        {order.jobId && <InfoRow label="Job ID" value={order.jobId} mono />}
        {order.assignedStaff && (
          <div className="flex items-center justify-between py-1">
            <span className="text-nh-muted text-sm">Assigned Staff</span>
            <span className="text-nh-text text-sm">
              {order.assignedStaff.displayName
                ?? `${order.assignedStaff.firstName ?? ''} ${order.assignedStaff.lastName ?? ''}`.trim()}
            </span>
          </div>
        )}
      </NHCard>

      {/* Review */}
      {order.customerReview && (
        <NHCard className="p-4">
          <h3 className="text-sm font-semibold text-nh-muted mb-2">Your Review</h3>
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={cn('w-4 h-4', i < order.customerReview!.rating ? 'text-amber-400' : 'text-nh-border')}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          {order.customerReview.reviewText && (
            <p className="text-sm text-nh-text mt-2">{order.customerReview.reviewText}</p>
          )}
        </NHCard>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-nh-muted text-sm">{label}</span>
      <span className={cn('text-nh-text text-sm max-w-[60%] text-right truncate', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}