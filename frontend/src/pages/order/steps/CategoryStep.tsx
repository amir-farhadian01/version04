import { useEffect, useState } from 'react';
import api from '../../../lib/api.js';
import { NHCard } from '../../../components/ui/NHCard.js';
import { NHButton } from '../../../components/ui/NHButton.js';
import type { OrderDraft } from '../../../services/orderDraft.js';

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryNode[];
}

interface CategoryStepProps {
  draft: OrderDraft;
  onUpdate: (patch: Partial<OrderDraft>) => void;
  onNext: () => void;
}

export default function CategoryStep({ draft, onUpdate, onNext }: CategoryStepProps) {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function fetchTree() {
      try {
        const res = await api.get<CategoryNode[]>('/categories/tree');
        if (!cancelled) {
          setTree(res.data ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load categories');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTree();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCategory = (node: CategoryNode) => {
    onUpdate({ categoryId: node.id, categoryName: node.name });
    onNext();
  };

  const renderNode = (node: CategoryNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = draft.categoryId === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            else selectCategory(node);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-xl ${
            isSelected
              ? 'bg-nh-primary/15 border border-nh-primary/30'
              : 'hover:bg-nh-surface-elevated border border-transparent'
          }`}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          {hasChildren ? (
            <svg
              className={`h-4 w-4 text-nh-text-muted transition-transform shrink-0 ${
                isExpanded ? 'rotate-90' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="text-sm text-nh-text">{node.name}</span>
          {!hasChildren && (
            <svg
              className="ml-auto h-4 w-4 text-nh-text-muted shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <NHCard>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-nh-primary border-t-transparent rounded-full" />
        </div>
      </NHCard>
    );
  }

  if (error) {
    return (
      <NHCard>
        <div className="p-6 text-center">
          <p className="text-sm text-nh-danger mb-3">{error}</p>
          <NHButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </NHButton>
        </div>
      </NHCard>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-nh-text mb-1">Select a Category</h2>
        <p className="text-sm text-nh-text-secondary">
          Choose the category that best describes your service need
        </p>
      </div>
      {draft.categoryId && (
        <p className="text-xs text-nh-primary">
          Selected: {draft.categoryName ?? draft.categoryId}
        </p>
      )}
      <NHCard>
        <div className="divide-y divide-nh-border">
          {tree.length === 0 ? (
            <div className="p-6 text-center text-sm text-nh-text-muted">
              No categories available
            </div>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>
      </NHCard>
    </div>
  );
}