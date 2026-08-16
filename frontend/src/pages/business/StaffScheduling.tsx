import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Clock, CheckCircle, X, Trash2 } from 'lucide-react';
import api from '../../lib/api';

interface StaffMember {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  assignedServices: Array<{
    serviceId: string;
    serviceName: string;
  }>;
  availability: string[];
}

interface Service {
  id: string;
  name: string;
  category: string;
  bookingMode: string;
}

interface AssignedStaff {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  serviceId: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StaffSchedulingPage() {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const queryClient = useQueryClient();

  const workspaceId = 'current-workspace';

  const { data: staffData, isLoading: loadingStaff } = useQuery({
    queryKey: ['workspace-staff', workspaceId],
    queryFn: () =>
      api
        .get(`/api/workspace/${workspaceId}/employees`)
        .then((r) => r.data.data as StaffMember[]),
    enabled: !!workspaceId,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['workspace-services', workspaceId],
    queryFn: () =>
      api
        .get(`/api/workspace/${workspaceId}/services`)
        .then((r) => r.data.data as Service[]),
    enabled: !!workspaceId,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['workspace-staff-assignments', workspaceId, selectedServiceId],
    queryFn: () =>
      selectedServiceId
        ? api
            .get(
              `/api/workspace/${workspaceId}/services/${selectedServiceId}/staff`
            )
            .then((r) => r.data.data as AssignedStaff[])
        : Promise.resolve([]),
    enabled: !!selectedServiceId,
  });

  const assignMutation = useMutation({
    mutationFn: ({
      userId,
      serviceId,
    }: {
      userId: string;
      serviceId: string;
    }) =>
      api.post(
        `/api/workspace/${workspaceId}/services/${serviceId}/staff`,
        { userId }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspace-staff-assignments', workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspace-staff', workspaceId],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({
      userId,
      serviceId,
    }: {
      userId: string;
      serviceId: string;
    }) =>
      api.delete(
        `/api/workspace/${workspaceId}/services/${serviceId}/staff/${userId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspace-staff-assignments', workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspace-staff', workspaceId],
      });
    },
  });

  const staff: StaffMember[] = staffData ?? [];
  const services: Service[] = servicesData ?? [];
  const assignments: AssignedStaff[] = assignmentsData ?? [];

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Scheduling</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage staff assignments, availability, and parallel scheduling
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Staff List */}
        <div className="w-[340px] flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Team Members ({staff.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingStaff ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                Loading...
              </div>
            ) : staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <UserPlus className="w-8 h-8 mb-2" />
                <p className="text-sm">No staff members</p>
              </div>
            ) : (
              staff.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStaffId(member.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-indigo-50/50 transition-colors ${
                    selectedStaffId === member.id
                      ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        member.displayName?.charAt(0)?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.displayName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {member.assignedServices.length} services
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Staff Detail + Assignments */}
        <div className="flex-1 space-y-6 overflow-y-auto">
          {/* Selected Staff Detail */}
          {selectedStaff ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-bold">
                  {selectedStaff.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedStaff.displayName}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedStaff.email}</p>
                </div>
              </div>

              {/* Assigned Services */}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Assigned Services
                </h3>
                {selectedStaff.assignedServices.length === 0 ? (
                  <p className="text-sm text-gray-400">Not assigned to any services</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedStaff.assignedServices.map((svc) => (
                      <div
                        key={svc.serviceId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-800">
                          {svc.serviceName}
                        </span>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weekly Schedule Placeholder */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Weekly Availability
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="flex flex-col items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors"
                    >
                      <span className="text-xs font-medium text-gray-500">{day}</span>
                      <Clock className="w-4 h-4 text-gray-400 mt-1" />
                      <span className="text-xs text-gray-600 mt-1">9-5</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-center h-48 text-gray-400 text-sm">
              Select a staff member to view details
            </div>
          )}

          {/* Service Assignment Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Service Assignments
              </h3>
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Assign Staff
              </button>
            </div>

            {/* Service selector */}
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a service to view assignments...</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.category})
                </option>
              ))}
            </select>

            {/* Assignments for selected service */}
            {selectedServiceId ? (
              assignments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No staff assigned to this service
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div
                      key={`${assignment.userId}-${assignment.serviceId}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold">
                          {assignment.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-800">
                          {assignment.displayName}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          removeMutation.mutate({
                            userId: assignment.userId,
                            serviceId: assignment.serviceId,
                          })
                        }
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                Select a service above to view staff assignments
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Assign Staff Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[450px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Assign Staff to Service</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <label className="text-xs font-medium text-gray-500">Service</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Select service...</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {staff
                .filter(
                  (s) =>
                    !assignments.some((a) => a.userId === s.id)
                )
                .map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      if (selectedServiceId) {
                        assignMutation.mutate({
                          userId: member.id,
                          serviceId: selectedServiceId,
                        });
                        setShowAssignModal(false);
                      }
                    }}
                    disabled={!selectedServiceId}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold">
                      {member.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-medium text-gray-800 flex-1 text-left">
                      {member.displayName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {member.assignedServices.length} services
                    </span>
                  </button>
                ))}
              {staff.filter((s) => !assignments.some((a) => a.userId === s.id))
                .length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  All staff members are already assigned
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}