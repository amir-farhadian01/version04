import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/api'

interface ScheduleBlock {
  id: string
  companyId: string
  staffId: string
  startTime: string
  endTime: string
  taskId: string | null
  status: string
  isActive: boolean
  staff: {
    id: string
    displayName: string | null
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }
}

interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: string
  staffRole: string | null
}

interface AvailableSlot {
  startTime: string
  endTime: string
  availableStaff: number
  staff: Array<{
    id: string
    displayName: string | null
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }>
}

interface PackageOption {
  id: string
  name: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

export default function CalendarManager() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New schedule form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStaffId, setNewStaffId] = useState('')
  const [newStartTime, setNewStartTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')

  // Slot preview
  const [showSlots, setShowSlots] = useState(false)
  const [packages, setPackages] = useState<PackageOption[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [slotDate, setSlotDate] = useState(formatDate(new Date()))
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const weekDates = getWeekDates(currentDate)
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]

  const fetchData = () => {
    if (!workspaceId) return
    setLoading(true)
    Promise.all([
      api.get(`/schedules/${workspaceId}`, {
        params: {
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
        },
      }),
      api.get(`/staff/${workspaceId}`),
    ])
      .then(([schedRes, staffRes]) => {
        setSchedules(schedRes.data.schedules ?? [])
        setStaffList(staffRes.data.staff ?? [])
      })
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load calendar'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [workspaceId, weekStart, weekEnd])

  // Fetch packages for slot preview
  useEffect(() => {
    if (!workspaceId) return
    api.get(`/business-page/${workspaceId}/services`)
      .then((res) => {
        setPackages((res.data.items ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})
  }, [workspaceId])

  const handleAddSchedule = async () => {
    if (!workspaceId || !newStaffId || !newStartTime || !newEndTime) return
    try {
      await api.post(`/schedules/${workspaceId}`, {
        staffId: newStaffId,
        startTime: new Date(newStartTime).toISOString(),
        endTime: new Date(newEndTime).toISOString(),
      })
      setShowAddForm(false)
      setNewStaffId('')
      setNewStartTime('')
      setNewEndTime('')
      fetchData()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create schedule')
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!workspaceId || !confirm('Delete this schedule block?')) return
    try {
      await api.delete(`/schedules/${workspaceId}/${scheduleId}`)
      fetchData()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete schedule')
    }
  }

  const handlePreviewSlots = async () => {
    if (!workspaceId || !selectedPackageId || !slotDate) return
    setSlotsLoading(true)
    try {
      const res = await api.get(`/schedules/${workspaceId}/slots`, {
        params: { date: slotDate, packageId: selectedPackageId },
      })
      setAvailableSlots(res.data.slots ?? [])
      setShowSlots(true)
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load slots')
    } finally {
      setSlotsLoading(false)
    }
  }

  const getSchedulesForDay = (date: Date) => {
    const dateStr = formatDate(date)
    return schedules.filter((s) => s.startTime.startsWith(dateStr))
  }

  if (loading) {
    return <div className="p-6 text-nh-text-secondary text-center">Loading calendar...</div>
  }

  if (error) {
    return <div className="p-6 text-nh-danger text-center">{error}</div>
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-lg font-bold text-nh-text font-heading">Calendar</div>
          <div className="text-xs text-nh-text-muted mt-0.5">
            {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSlots(!showSlots)}
            className={`rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer border border-nh-border ${showSlots ? 'bg-nh-primary text-white' : 'bg-transparent text-nh-text-secondary'}`}
          >
            Slots
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-nh-primary text-white border-0 rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer"
          >
            + Block
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }} className="bg-transparent border-0 text-nh-primary cursor-pointer text-sm">
          ← Prev
        </button>
        <button onClick={() => setCurrentDate(new Date())} className="bg-transparent border-0 text-nh-text-muted cursor-pointer text-[11px]">
          Today
        </button>
        <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }} className="bg-transparent border-0 text-nh-primary cursor-pointer text-sm">
          Next →
        </button>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {weekDates.map((date, i) => {
          const daySchedules = getSchedulesForDay(date)
          const isToday = formatDate(date) === formatDate(new Date())
          return (
            <div
              key={i}
              className={`rounded-lg p-1.5 min-h-[80px] ${isToday ? 'bg-nh-primary/8 border-nh-primary' : 'bg-nh-surface border-nh-border'} border`}
            >
              <div className={`text-[10px] font-semibold text-center mb-1 ${isToday ? 'text-nh-primary' : 'text-nh-text-secondary'}`}>
                {DAYS[date.getDay()]}<br />{date.getDate()}
              </div>
              {daySchedules.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className={`text-[8px] px-1 py-0.5 rounded mb-0.5 cursor-pointer truncate ${s.isActive ? 'bg-nh-success/15 text-nh-success' : 'bg-nh-surface-elevated text-nh-text-muted'}`}
                  title={`${s.staff.displayName ?? s.staff.firstName ?? ''}: ${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                >
                  {s.staff.firstName ?? s.staff.displayName ?? '?'}
                </div>
              ))}
              {daySchedules.length > 3 && (
                <div className="text-[8px] text-nh-text-muted text-center">+{daySchedules.length - 3}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Schedule Form */}
      {showAddForm && (
        <div className="bg-nh-surface rounded-xl p-4 mb-4 border border-nh-border">
          <div className="text-sm font-semibold text-nh-text mb-3">Add Schedule Block</div>
          <div className="flex flex-col gap-2.5">
            <select value={newStaffId} onChange={(e) => setNewStaffId(e.target.value)} className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs">
              <option value="">Select staff member</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`}</option>
              ))}
            </select>
            <label className="text-[11px] text-nh-text-muted">Start Time</label>
            <input type="datetime-local" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs" />
            <label className="text-[11px] text-nh-text-muted">End Time</label>
            <input type="datetime-local" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs" />
            <div className="flex gap-2">
              <button onClick={handleAddSchedule} className="flex-1 bg-nh-primary text-white border-0 rounded-lg py-2 text-xs font-semibold cursor-pointer">Create Block</button>
              <button onClick={() => setShowAddForm(false)} className="bg-transparent text-nh-text-muted border border-nh-border rounded-lg px-4 py-2 text-xs cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Preview */}
      {showSlots && (
        <div className="bg-nh-surface rounded-xl p-4 mb-4 border border-nh-border">
          <div className="text-sm font-semibold text-nh-text mb-3">Available Slots Preview</div>
          <div className="flex flex-col gap-2.5">
            <select value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value)} className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs">
              <option value="">Select a service</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs" />
            <button onClick={handlePreviewSlots} disabled={!selectedPackageId || slotsLoading} className="bg-nh-primary text-white border-0 rounded-lg py-2 text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              {slotsLoading ? 'Loading...' : 'Preview Slots'}
            </button>
          </div>

          {availableSlots.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-nh-text mb-2">Available slots for {slotDate}</div>
              {availableSlots.map((slot, i) => (
                <div key={i} className="flex justify-between items-center px-3 py-2 bg-nh-bg rounded-lg mb-1.5 border border-nh-border">
                  <div>
                    <span className="text-xs font-semibold text-nh-text">{slot.startTime}</span>
                    <span className="text-[11px] text-nh-text-muted ml-1">- {slot.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-nh-success font-semibold">{slot.availableStaff} staff</span>
                    <div className="flex">
                      {slot.staff.slice(0, 2).map((s) => (
                        <div key={s.id} className="w-5 h-5 rounded-full border-2 border-nh-surface -ml-1 bg-nh-surface-elevated flex items-center justify-center text-[8px] font-semibold text-nh-text-secondary overflow-hidden"
                          title={s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`}>
                          {s.avatarUrl ? (
                            <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (s.firstName?.[0] ?? s.displayName?.[0] ?? '?').toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {availableSlots.length === 0 && selectedPackageId && !slotsLoading && (
            <div className="text-center text-xs text-nh-text-muted mt-3">No available slots for this date/service</div>
          )}
        </div>
      )}

      {/* Schedule List */}
      <div className="text-sm font-semibold text-nh-text mb-2.5 font-heading">All Schedule Blocks</div>
      {schedules.length === 0 ? (
        <div className="text-center text-[13px] text-nh-text-muted p-6">No schedule blocks yet. Add your first one!</div>
      ) : (
        schedules.map((s) => (
          <div key={s.id} className="bg-nh-surface rounded-[10px] p-3 mb-2 border border-nh-border flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-nh-surface-elevated flex items-center justify-center text-[10px] font-semibold text-nh-text-secondary overflow-hidden shrink-0">
                  {s.staff.avatarUrl ? (
                    <img src={s.staff.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (s.staff.firstName?.[0] ?? s.staff.displayName?.[0] ?? '?').toUpperCase()
                  )}
                </div>
                <span className="text-xs font-semibold text-nh-text">{s.staff.displayName ?? `${s.staff.firstName ?? ''} ${s.staff.lastName ?? ''}`}</span>
              </div>
              <div className="text-[11px] text-nh-text-muted ml-8">
                {new Date(s.startTime).toLocaleString()} - {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button onClick={() => handleDeleteSchedule(s.id)} className="bg-transparent border-0 text-nh-danger text-lg cursor-pointer px-2 py-1" title="Delete">×</button>
          </div>
        ))
      )}
    </div>
  )
}