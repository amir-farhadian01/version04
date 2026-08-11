import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, FileText, MessageCircle, Clock, DollarSign } from 'lucide-react';
import { api } from '../../app/api';

interface Customer {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  notes: string | null;
}

interface CustomerDetail extends Customer {
  orders: Array<{
    id: string;
    serviceName: string;
    status: string;
    createdAt: string;
    totalAmount: number;
  }>;
  allNotes: Array<{
    id: string;
    content: string;
    createdAt: string;
  }>;
}

const CRM_PAGE_SIZE = 20;

export default function CRMPage() {
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // NOTE: workspaceId should come from auth context — using placeholder for now
  const workspaceId = 'current-workspace';

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['workspace-customers', workspaceId, search, page],
    queryFn: () =>
      api
        .get(`/api/workspace/${workspaceId}/crm/customers`, {
          params: { search, page, pageSize: CRM_PAGE_SIZE },
        })
        .then((r) => r.data),
    enabled: !!workspaceId,
  });

  const { data: customerDetail } = useQuery({
    queryKey: ['workspace-customer', workspaceId, selectedCustomerId],
    queryFn: () =>
      api
        .get(`/api/workspace/${workspaceId}/crm/customers/${selectedCustomerId}`)
        .then((r) => r.data.data as CustomerDetail),
    enabled: !!selectedCustomerId,
  });

  const addNoteMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/api/workspace/${workspaceId}/crm/customers/${selectedCustomerId}/notes`,
        { note: newNote }
      ),
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({
        queryKey: ['workspace-customer', workspaceId, selectedCustomerId],
      });
    },
  });

  const customers: Customer[] = customersData?.data ?? [];
  const total = customersData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CRM_PAGE_SIZE));

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your client relationships, order history, and notes
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Customer List Panel */}
        <div className="w-[380px] flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                Loading customers...
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <FileText className="w-8 h-8 mb-2" />
                <p className="text-sm">No customers yet</p>
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-indigo-50/50 transition-colors ${
                    selectedCustomerId === customer.id
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {customer.avatarUrl ? (
                        <img
                          src={customer.avatarUrl}
                          alt={customer.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        customer.displayName?.charAt(0)?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {customer.displayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {customer.totalOrders} orders
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${((customer.totalSpent ?? 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-3 py-1.5 bg-gray-100 rounded-md disabled:opacity-40 hover:bg-gray-200 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs px-3 py-1.5 bg-gray-100 rounded-md disabled:opacity-40 hover:bg-gray-200 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Customer Detail Panel */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto">
          {!selectedCustomerId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">Select a customer</p>
              <p className="text-xs mt-1">View order history and manage notes</p>
            </div>
          ) : customerDetail ? (
            <div className="p-6 space-y-6">
              {/* Customer Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {customerDetail.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {customerDetail.displayName}
                  </h2>
                  <p className="text-sm text-gray-500">{customerDetail.email}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-indigo-600 font-medium">
                      {customerDetail.totalOrders} orders
                    </span>
                    <span className="text-xs text-green-600 font-medium">
                      ${((customerDetail.totalSpent ?? 0) / 100).toFixed(2)} total
                    </span>
                  </div>
                </div>
              </div>

              {/* Order History */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Order History</h3>
                {customerDetail.orders.length === 0 ? (
                  <p className="text-sm text-gray-400">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {customerDetail.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.serviceName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : order.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {order.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            ${((order.totalAmount ?? 0) / 100).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
                {customerDetail.allNotes.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-3">No notes yet</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {customerDetail.allNotes.map((note) => (
                      <div key={note.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <p className="text-sm text-gray-800">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Note */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a note about this customer..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newNote.trim()) {
                        addNoteMutation.mutate();
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newNote.trim()) addNoteMutation.mutate();
                    }}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}