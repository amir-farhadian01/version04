import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, ExternalLink, BarChart3, Archive, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';

interface UtilityLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  commissionRate: number | null;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  archivedAt: string | null;
}

interface UtilityLinkFormData {
  title: string;
  url: string;
  description: string;
  category: string;
  iconUrl: string;
  commissionRate: number | null;
}

const CATEGORIES = ['Banks', 'Insurance', 'Fuel', 'Government', 'Health', 'Transit', 'Education', 'Other'];

const emptyForm: UtilityLinkFormData = {
  title: '',
  url: '',
  description: '',
  category: 'Other',
  iconUrl: '',
  commissionRate: null,
};

export default function UtilityLinksPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UtilityLinkFormData>(emptyForm);
  const [filter, setFilter] = useState('');
  const queryClient = useQueryClient();

  const { data: linksData, isLoading } = useQuery({
    queryKey: ['admin-utility-links'],
    queryFn: () =>
      api.get('/api/admin/utility-links').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: UtilityLinkFormData) =>
      api.post('/api/admin/utility-links', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-utility-links'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UtilityLinkFormData> }) =>
      api.put(`/api/admin/utility-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-utility-links'] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/admin/utility-links/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-utility-links'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/admin/utility-links/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-utility-links'] });
    },
  });

  const links: UtilityLink[] = linksData?.data ?? [];

  const filteredLinks = links.filter(
    (l) =>
      !filter ||
      l.category === filter ||
      l.title.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSubmit = () => {
    if (!form.title || !form.url) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (link: UtilityLink) => {
    setEditingId(link.id);
    setForm({
      title: link.title,
      url: link.url,
      description: link.description ?? '',
      category: link.category,
      iconUrl: link.iconUrl ?? '',
      commissionRate: link.commissionRate,
    });
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utility Links</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage public utility links with commission tracking and click analytics
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Link
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search links or filter by category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(filter === cat ? '' : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === cat
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Links Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  URL
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Commission
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Clicks
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    No utility links found
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => (
                  <tr
                    key={link.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      link.archivedAt ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{link.title}</p>
                      {link.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                          {link.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                        {link.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {new URL(link.url).hostname}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {link.commissionRate != null ? (
                        <span className="text-sm font-medium text-green-600">
                          {link.commissionRate}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {link.clickCount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          link.archivedAt
                            ? 'bg-red-50 text-red-600'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {link.archivedAt ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(link)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {link.archivedAt ? (
                          <button
                            onClick={() => restoreMutation.mutate(link.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Restore"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => archiveMutation.mutate(link.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Link' : 'Add Utility Link'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., RBC Royal Bank"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">URL *</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://www.rbcroyalbank.com"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this link"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Icon URL</label>
                <input
                  type="url"
                  value={form.iconUrl}
                  onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={form.commissionRate ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      commissionRate: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="e.g., 2.5"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title || !form.url || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingId
                  ? 'Update'
                  : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}