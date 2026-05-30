import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api.js';
import { useAuthStore } from '../../../store/authStore.js';
import { NHCard } from '../../../components/ui/NHCard.js';
import { NHButton } from '../../../components/ui/NHButton.js';
import { cn } from '../../../lib/cn.js';
import type { OrderDetailData } from '../../../services/orders.js';

interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  type: string;
  displayText: string;
  originalText: string;
  moderationStatus: string;
  moderationReasons?: string[];
  translatedText?: string | null;
  sourceLang?: string | null;
  createdAt: string;
}

interface ChatThreadData {
  thread: { id: string; orderId: string; customerId: string; providerId: string; isClosed: boolean };
  messages: ChatMessage[];
  role: string;
  readOnly: boolean;
}

interface Props { orderId: string; order: OrderDetailData; }

export default function OrderChatTab({ orderId, order }: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState('');
  const [agreementText, setAgreementText] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<ChatThreadData>({
    queryKey: ['order-chat', orderId],
    queryFn: async () => { const r = await api.get(`/orders/${orderId}/chat/thread`); return r.data; },
    enabled: Boolean(orderId),
    retry: false,
    refetchInterval: 8000,
    staleTime: 5000,
  });

  const send = useMutation({
    mutationFn: async (t: string) => { const r = await api.post(`/orders/${orderId}/chat/messages`, { text: t }); return r.data as ChatMessage; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['order-chat', orderId] }); setText(''); setSendErr(''); },
    onError: (e: unknown) => {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send';
      setSendErr(m); setTimeout(() => setSendErr(''), 5000);
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.messages]);

  if (isLoading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-nh-primary border-t-transparent" /></div>;
  if (error || !data) return <NHCard className="p-6 text-center"><p className="text-nh-muted text-sm">Chat is not available for this order. A provider must be matched first.</p></NHCard>;

  const messages = data.messages ?? [];
  const isReadOnly = data.readOnly === true;
  const isClosed = data.thread.isClosed;

  return (
    <div className="space-y-4">
      {/* PII Warning Banner */}
      <div className="p-3 rounded-md bg-amber-400/10 border border-amber-400/20">
        <p className="text-xs text-amber-400 font-medium">⚠️ Privacy Notice</p>
        <p className="text-xs text-nh-muted mt-1">
          Sharing personal contact information (phone, email, address) is blocked for your safety.
          Keep all communication in-app until a contract is approved.
        </p>
      </div>

      {/* Provider info */}
      {order.matchedSummary && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-nh-surface-elevated">
          <div className="h-8 w-8 rounded-full bg-nh-primary/20 flex items-center justify-center text-nh-primary font-bold text-xs shrink-0">
            {order.matchedSummary.provider.displayName?.[0]?.toUpperCase() ?? order.matchedSummary.provider.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm text-nh-text font-medium">
              {order.matchedSummary.provider.displayName ?? `${order.matchedSummary.provider.firstName ?? ''} ${order.matchedSummary.provider.lastName ?? ''}`.trim()}
            </p>
            <p className="text-xs text-nh-muted">{order.matchedSummary.workspace.name}</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-1 max-h-80 overflow-y-auto" role="log" aria-label="Chat messages">
        {messages.length === 0 && (
          <p className="text-center text-nh-muted text-sm py-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-lg px-3 py-2 text-sm', isMe ? 'bg-nh-primary/20 text-nh-text' : 'bg-nh-surface-elevated text-nh-text')}>
                <p className="whitespace-pre-wrap break-words">{msg.displayText}</p>
                {msg.moderationStatus !== 'clean' && (
                  <p className="text-[10px] text-amber-400 mt-1">⚠️ Content moderated</p>
                )}
                <p className="text-[10px] text-nh-muted mt-1 text-right">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send error */}
      {sendErr && (
        <div className="p-2 rounded-md bg-red-400/10 text-red-400 text-xs">{sendErr}</div>
      )}

      {/* "I have reached an agreement" button */}
      {!isClosed && !isReadOnly && (
        <div className="border-t border-nh-border pt-3">
          {!showAgreement ? (
            <NHButton variant="ghost" size="sm" onClick={() => setShowAgreement(true)} className="text-xs">
              🤝 I have reached an agreement
            </NHButton>
          ) : (
            <div className="space-y-3">
              <textarea
                className="w-full rounded-md bg-nh-surface-elevated border border-nh-border text-nh-text text-sm p-3 placeholder-nh-muted resize-none h-24"
                placeholder="Describe what you agreed on (scope, price, timeline)..."
                value={agreementText}
                onChange={(e) => setAgreementText(e.target.value)}
              />
              <div className="flex gap-2">
                <NHButton size="sm" variant="primary" disabled={!agreementText.trim()} onClick={() => {
                  if (agreementText.trim()) send.mutate(`📋 Agreement reached: ${agreementText.trim()}`);
                  setShowAgreement(false);
                  setAgreementText('');
                }}>
                  Send Agreement Summary
                </NHButton>
                <NHButton size="sm" variant="ghost" onClick={() => { setShowAgreement(false); setAgreementText(''); }}>
                  Cancel
                </NHButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      {!isClosed && !isReadOnly && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate(text.trim());
          }}
        >
          <input
            className="flex-1 rounded-md bg-nh-surface-elevated border border-nh-border text-nh-text text-sm px-3 py-2 placeholder-nh-muted focus:outline-none focus:border-nh-primary/50"
            placeholder={send.isPending ? 'Sending...' : 'Type a message...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={send.isPending}
            aria-label="Chat message input"
          />
          <NHButton type="submit" size="sm" loading={send.isPending} disabled={!text.trim()}>
            Send
          </NHButton>
        </form>
      )}

      {isReadOnly && !isClosed && (
        <p className="text-xs text-nh-muted text-center">Chat is read-only until your workspace is the matched provider.</p>
      )}
      {isClosed && (
        <p className="text-xs text-nh-muted text-center">This chat thread is closed.</p>
      )}
    </div>
  );
}