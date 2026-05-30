import { useState, useEffect, useCallback } from 'react';
import { NHCard } from '../../components/ui/NHCard';
import api from '../../lib/api';
import { cn } from '../../lib/cn';

interface MessagesTabProps {
  onNavigate: (orderId: string) => void;
}

interface Conversation {
  providerId: string;
  provider: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  service: {
    id: string;
    title: string;
  } | null;
  lastMessage: string;
  timestamp: string;
  read: boolean;
  orderId?: string;
}

const SEGMENTS = [
  { id: 'active' as const, label: 'Active' },
  { id: 'offers' as const, label: 'Offers' },
  { id: 'history' as const, label: 'History' },
];

type SegmentId = (typeof SEGMENTS)[number]['id'];

/**
 * MessagesTab — Conversation list with Active/Offers/History segment tabs and unread badges.
 */
export function MessagesTab({ onNavigate }: MessagesTabProps) {
  const [segment, setSegment] = useState<SegmentId>('active');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get<Conversation[]>('/chat/provider-messages');
      setConversations(res.data);
      setError(null);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const unreadCount = conversations.filter((c) => !c.read).length;

  const filteredConversations = (() => {
    switch (segment) {
      case 'active':
        return conversations.filter((c) => !c.read || c.service !== null);
      case 'offers':
        return conversations.filter((c) => c.service !== null && !c.read);
      case 'history':
        return conversations.filter((c) => c.read);
      default:
        return conversations;
    }
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="sr-only">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchConversations}
          className="text-blue-600 hover:underline focus:outline-none"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unread Badge Header */}
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-nh-primary text-white text-xs font-bold">
            {unreadCount}
          </span>
          <span className="text-sm text-nh-text-secondary">
            unread {unreadCount === 1 ? 'message' : 'messages'}
          </span>
        </div>
      )}

      {/* Segment Tabs */}
      <div className="flex bg-nh-surface rounded-nh-card p-1 border border-nh-border">
        {SEGMENTS.map((seg) => {
          const count =
            seg.id === 'active'
              ? filteredConversations.length
              : seg.id === 'offers'
                ? unreadCount
                : conversations.filter((c) => c.read).length;
          return (
            <button
              key={seg.id}
              onClick={() => setSegment(seg.id)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-nh-btn transition-colors relative',
                segment === seg.id
                  ? 'bg-nh-primary text-white'
                  : 'text-nh-text-secondary hover:text-nh-text',
              )}
            >
              {seg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Conversation List */}
      {filteredConversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">
            {segment === 'offers' ? '📨' : segment === 'history' ? '📋' : '💬'}
          </div>
          <p className="text-nh-text-secondary text-sm">
            {segment === 'offers'
              ? 'No new offers'
              : segment === 'history'
                ? 'No past conversations'
                : 'No active conversations'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <ConversationCard
              key={conv.providerId}
              conversation={conv}
              onClick={() => {
                if (conv.orderId) {
                  onNavigate(conv.orderId);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationCard({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick: () => void;
}) {
  const initials = getInitials(
    conversation.provider?.displayName || 'Provider',
  );

  return (
    <NHCard
      clickable
      className={cn('p-3 flex items-center gap-3', !conversation.read && 'border-nh-primary/50')}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {conversation.provider?.avatarUrl ? (
          <img
            src={conversation.provider.avatarUrl}
            alt={conversation.provider.displayName || 'Provider'}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-nh-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-nh-primary">{initials}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-nh-text truncate">
            {conversation.provider?.displayName || 'Provider'}
          </p>
          <span className="text-xs text-nh-text-muted whitespace-nowrap ml-2">
            {formatTimestamp(conversation.timestamp)}
          </span>
        </div>
        {conversation.service?.title && (
          <p className="text-xs text-nh-primary mt-0.5 truncate">
            {conversation.service.title}
          </p>
        )}
        <p
          className={cn(
            'text-xs mt-0.5 truncate',
            conversation.read ? 'text-nh-text-muted' : 'text-nh-text-secondary font-medium',
          )}
        >
          {conversation.lastMessage}
        </p>
      </div>

      {/* Unread Dot */}
      {!conversation.read && (
        <div className="flex-shrink-0">
          <span className="block h-2.5 w-2.5 rounded-full bg-nh-primary" />
        </div>
      )}
    </NHCard>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

