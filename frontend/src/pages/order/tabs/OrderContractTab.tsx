import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NHCard } from '../../../components/ui/NHCard.js';
import { NHButton } from '../../../components/ui/NHButton.js';
import { cn } from '../../../lib/cn.js';
import type { OrderDetailData } from '../../../services/orders.js';
import { fetchContractBundle, approveContract, rejectContract, type ContractBundle } from '../../../services/orderContracts.js';

const VSL: Record<string, string> = { draft: 'Draft', sent: 'Sent', approved: 'Approved', rejected: 'Rejected', superseded: 'Superseded' };
const VSC: Record<string, string> = { draft: 'bg-nh-muted/10 text-nh-muted', sent: 'bg-blue-400/10 text-blue-400', approved: 'bg-green-400/10 text-green-400', rejected: 'bg-red-400/10 text-red-400', superseded: 'bg-nh-muted/5 text-nh-muted/60' };

interface Props { orderId: string; order: OrderDetailData; }

export default function OrderContractTab({ orderId, order }: Props) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [msg, setMsg] = useState('');

  const { data, isLoading, error } = useQuery<ContractBundle>({
    queryKey: ['order-contract', orderId],
    queryFn: () => fetchContractBundle(orderId),
    enabled: Boolean(orderId),
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (vid: string) => approveContract(orderId, vid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['order-contract', orderId] }); qc.invalidateQueries({ queryKey: ['order', orderId] }); setMsg('Contract approved.'); setTimeout(() => setMsg(''), 4000); },
    onError: (e: unknown) => { const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'; setMsg(m); setTimeout(() => setMsg(''), 4000); },
  });

  const reject = useMutation({
    mutationFn: (vid: string) => rejectContract(orderId, vid, note, false),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['order-contract', orderId] }); setNote(''); setShowReject(false); setMsg('Contract rejected.'); setTimeout(() => setMsg(''), 4000); },
    onError: (e: unknown) => { const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'; setMsg(m); setTimeout(() => setMsg(''), 4000); },
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-nh-primary border-t-transparent" /></div>;
  if (error || !data) return <NHCard className="p-6 text-center"><p className="text-nh-muted text-sm">Contract not available</p></NHCard>;

  const cv = data.contract?.currentVersion ?? null;
  const versions = data.versions ?? [];
  const events = data.events ?? [];
  const latestSent = [...versions].filter((v) => v.status === 'sent').sort((a, b) => b.versionNumber - a.versionNumber)[0];

  return (
    <div className="space-y-6">
      {msg && (
        <div className={cn('p-3 rounded-md text-sm', msg.includes('Failed') ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-green-400/10 text-green-400 border border-green-400/20')}>
          {msg}
        </div>
      )}

      {/* Current version */}
      {cv && (
        <NHCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-nh-muted">Current Contract — v{cv.versionNumber}</h3>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', VSC[cv.status] ?? '')}>{VSL[cv.status] ?? cv.status}</span>
          </div>
          <div className="space-y-3">
            <div><p className="text-xs text-nh-muted mb-1">Title</p><p className="text-sm text-nh-text font-medium">{cv.title}</p></div>
            {cv.amount != null && <div><p className="text-xs text-nh-muted mb-1">Amount</p><p className="text-sm text-nh-text">{cv.currency ?? 'CAD'} {(cv.amount / 100).toFixed(2)}</p></div>}
            {cv.scopeSummary && <div><p className="text-xs text-nh-muted mb-1">Scope</p><p className="text-sm text-nh-text">{cv.scopeSummary}</p></div>}
            {cv.termsMarkdown && (
              <div><p className="text-xs text-nh-muted mb-1">Terms</p><pre className="text-xs text-nh-text whitespace-pre-wrap font-sans bg-nh-surface-elevated p-3 rounded-md max-h-48 overflow-y-auto">{cv.termsMarkdown}</pre></div>
            )}
          </div>

          {/* Actions */}
          {latestSent && latestSent.status === 'sent' && order.status !== 'cancelled' && (
            <div className="mt-4 flex gap-3">
              <NHButton size="sm" variant="primary" loading={approve.isPending} onClick={() => approve.mutate(latestSent.id)}>Approve</NHButton>
              <NHButton size="sm" variant="ghost" onClick={() => setShowReject(!showReject)}>{showReject ? 'Cancel' : 'Reject'}</NHButton>
            </div>
          )}
          {showReject && (
            <div className="mt-4 space-y-3">
              <textarea className="w-full rounded-md bg-nh-surface-elevated border border-nh-border text-nh-text text-sm p-3 placeholder-nh-muted resize-none h-20" placeholder="Reason (optional)..." value={note} onChange={(e) => setNote(e.target.value)} />
              <NHButton size="sm" variant="secondary" loading={reject.isPending} onClick={() => latestSent && reject.mutate(latestSent.id)}>Confirm Rejection</NHButton>
            </div>
          )}
        </NHCard>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <NHCard className="p-4">
          <h3 className="text-sm font-semibold text-nh-muted mb-4">Version History</h3>
          <div className="space-y-2">
            {versions.sort((a, b) => b.versionNumber - a.versionNumber).map((v) => (
              <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-nh-surface-elevated">
                <div><p className="text-sm text-nh-text font-medium">v{v.versionNumber} — {v.title}</p><p className="text-xs text-nh-muted">{new Date(v.createdAt).toLocaleDateString()}</p></div>
                <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', VSC[v.status] ?? '')}>{VSL[v.status] ?? v.status}</span>
              </div>
            ))}
          </div>
        </NHCard>
      )}

      {!data.contract && (
        <NHCard className="p-6 text-center"><p className="text-nh-muted text-sm">No contract has been created yet.</p><p className="text-nh-muted text-xs mt-1">A contract will appear when the provider sends a draft.</p></NHCard>
      )}

      {events.length > 0 && (
        <NHCard className="p-4">
          <h3 className="text-sm font-semibold text-nh-muted mb-3">Activity Log</h3>
          <div className="space-y-2">
            {events.slice(0, 20).map((evt) => (
              <div key={evt.id} className="flex items-center justify-between py-1">
                <div><p className="text-xs text-nh-text">{evt.actionType}</p>{evt.note && <p className="text-xs text-nh-muted">{evt.note}</p>}</div>
                <p className="text-xs text-nh-muted">{evt.actorRole} · {new Date(evt.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </NHCard>
      )}
    </div>
  );
}