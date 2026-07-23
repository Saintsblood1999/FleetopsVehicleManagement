import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'admin' | 'driver'
type VehicleType = 'truck' | 'van' | 'trailer' | 'pickup' | 'box_truck' | 'garbage_truck'
type VehicleStatus = 'active' | 'maintenance' | 'inactive'
type ChecklistItemType = 'yesno' | 'number' | 'text' | 'passfail'
type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'
type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical'

interface User { id: string; name: string; email: string; password: string; role: Role }
interface Vehicle { id: string; name: string; type: VehicleType; plate: string; year: string; make: string; model: string; assignedDriverId: string | null; status: VehicleStatus; mileage: string; addedAt: string }
interface ChecklistItem { id: string; label: string; type: ChecklistItemType; required: boolean; placeholder?: string }
interface ChecklistTemplate { vehicleType: VehicleType; items: ChecklistItem[] }
interface SubmissionItem { itemId: string; value: string }
interface Submission { id: string; vehicleId: string; driverId: string; date: string; items: SubmissionItem[]; notes: string; odometer: string }
interface MaintenanceRequest { id: string; vehicleId: string; driverId: string; date: string; description: string; status: MaintenanceStatus; priority: MaintenancePriority; adminNotes: string }

// ─── Storage ──────────────────────────────────────────────────────────────────

const K = { users: 'fleet_users', vehicles: 'fleet_vehicles', templates: 'fleet_templates', submissions: 'fleet_submissions', maintenance: 'fleet_maintenance' }
const load = <T,>(key: string, fb: T): T => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb } }
const save = <T,>(key: string, data: T) => localStorage.setItem(key, JSON.stringify(data))
const uid = () => Math.random().toString(36).slice(2, 10)

const DEFAULT_TEMPLATES: ChecklistTemplate[] = [
  { vehicleType: 'truck', items: [
    { id: 'tk1', label: 'Engine oil level', type: 'passfail', required: true },
    { id: 'tk2', label: 'Coolant level', type: 'passfail', required: true },
    { id: 'tk3', label: 'Brake fluid', type: 'passfail', required: true },
    { id: 'tk4', label: 'Tire pressure – Front Left (PSI)', type: 'number', required: true, placeholder: '110' },
    { id: 'tk5', label: 'Tire pressure – Front Right (PSI)', type: 'number', required: true, placeholder: '110' },
    { id: 'tk6', label: 'Tire pressure – Rear Left (PSI)', type: 'number', required: true, placeholder: '110' },
    { id: 'tk7', label: 'Tire pressure – Rear Right (PSI)', type: 'number', required: true, placeholder: '110' },
    { id: 'tk8', label: 'Headlights', type: 'passfail', required: true },
    { id: 'tk9', label: 'Tail lights', type: 'passfail', required: true },
    { id: 'tk10', label: 'Turn signals', type: 'passfail', required: true },
    { id: 'tk11', label: 'Brakes', type: 'passfail', required: true },
    { id: 'tk12', label: 'Horn', type: 'passfail', required: true },
    { id: 'tk13', label: 'Windshield wipers', type: 'passfail', required: true },
    { id: 'tk14', label: 'All mirrors', type: 'passfail', required: true },
    { id: 'tk15', label: 'Seatbelt', type: 'passfail', required: true },
    { id: 'tk16', label: 'Fire extinguisher present', type: 'yesno', required: true },
    { id: 'tk17', label: 'First aid kit present', type: 'yesno', required: true },
    { id: 'tk18', label: 'Load secure / cargo straps', type: 'passfail', required: false },
    { id: 'tk19', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
  { vehicleType: 'van', items: [
    { id: 'vn1', label: 'Engine oil level', type: 'passfail', required: true },
    { id: 'vn2', label: 'Coolant level', type: 'passfail', required: true },
    { id: 'vn3', label: 'Tire pressure – Front Left (PSI)', type: 'number', required: true, placeholder: '80' },
    { id: 'vn4', label: 'Tire pressure – Front Right (PSI)', type: 'number', required: true, placeholder: '80' },
    { id: 'vn5', label: 'Tire pressure – Rear Left (PSI)', type: 'number', required: true, placeholder: '80' },
    { id: 'vn6', label: 'Tire pressure – Rear Right (PSI)', type: 'number', required: true, placeholder: '80' },
    { id: 'vn7', label: 'Headlights', type: 'passfail', required: true },
    { id: 'vn8', label: 'Tail lights', type: 'passfail', required: true },
    { id: 'vn9', label: 'Sliding door operation', type: 'passfail', required: true },
    { id: 'vn10', label: 'Brakes', type: 'passfail', required: true },
    { id: 'vn11', label: 'Cargo area secure', type: 'passfail', required: false },
    { id: 'vn12', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
  { vehicleType: 'pickup', items: [
    { id: 'pu1', label: 'Engine oil level', type: 'passfail', required: true },
    { id: 'pu2', label: 'Coolant level', type: 'passfail', required: true },
    { id: 'pu3', label: 'Tire pressure – Front Left (PSI)', type: 'number', required: true, placeholder: '35' },
    { id: 'pu4', label: 'Tire pressure – Front Right (PSI)', type: 'number', required: true, placeholder: '35' },
    { id: 'pu5', label: 'Tire pressure – Rear Left (PSI)', type: 'number', required: true, placeholder: '35' },
    { id: 'pu6', label: 'Tire pressure – Rear Right (PSI)', type: 'number', required: true, placeholder: '35' },
    { id: 'pu7', label: 'All lights', type: 'passfail', required: true },
    { id: 'pu8', label: 'Brakes', type: 'passfail', required: true },
    { id: 'pu9', label: 'Bed / cargo tie-downs', type: 'passfail', required: false },
    { id: 'pu10', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
  { vehicleType: 'trailer', items: [
    { id: 'tr1', label: 'Hitch / coupling secure', type: 'passfail', required: true },
    { id: 'tr2', label: 'Safety chains attached', type: 'passfail', required: true },
    { id: 'tr3', label: 'Tire pressure – Left (PSI)', type: 'number', required: true, placeholder: '65' },
    { id: 'tr4', label: 'Tire pressure – Right (PSI)', type: 'number', required: true, placeholder: '65' },
    { id: 'tr5', label: 'Trailer lights', type: 'passfail', required: true },
    { id: 'tr6', label: 'Brake lights', type: 'passfail', required: true },
    { id: 'tr7', label: 'Load secure / straps', type: 'passfail', required: true },
    { id: 'tr8', label: 'Floor / deck condition', type: 'passfail', required: true },
    { id: 'tr9', label: 'Doors / ramp', type: 'passfail', required: false },
    { id: 'tr10', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
  { vehicleType: 'box_truck', items: [
    { id: 'bt1', label: 'Engine oil level', type: 'passfail', required: true },
    { id: 'bt2', label: 'Coolant level', type: 'passfail', required: true },
    { id: 'bt3', label: 'Tire pressure – Front Left (PSI)', type: 'number', required: true, placeholder: '100' },
    { id: 'bt4', label: 'Tire pressure – Front Right (PSI)', type: 'number', required: true, placeholder: '100' },
    { id: 'bt5', label: 'Tire pressure – Rear Left (PSI)', type: 'number', required: true, placeholder: '100' },
    { id: 'bt6', label: 'Tire pressure – Rear Right (PSI)', type: 'number', required: true, placeholder: '100' },
    { id: 'bt7', label: 'Headlights & running lights', type: 'passfail', required: true },
    { id: 'bt8', label: 'Tail lights', type: 'passfail', required: true },
    { id: 'bt9', label: 'Box door / roll-up', type: 'passfail', required: true },
    { id: 'bt10', label: 'Liftgate operation', type: 'passfail', required: false },
    { id: 'bt11', label: 'Brakes', type: 'passfail', required: true },
    { id: 'bt12', label: 'Fire extinguisher present', type: 'yesno', required: true },
    { id: 'bt13', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
  { vehicleType: 'garbage_truck', items: [
    { id: 'gt1', label: 'Engine oil level', type: 'passfail', required: true },
    { id: 'gt2', label: 'Coolant level', type: 'passfail', required: true },
    { id: 'gt3', label: 'Hydraulic fluid level', type: 'passfail', required: true },
    { id: 'gt4', label: 'Hydraulic fluid condition (no discoloration / contamination)', type: 'passfail', required: true },
    { id: 'gt5', label: 'Hydraulic hoses & fittings – leaks or damage', type: 'passfail', required: true },
    { id: 'gt6', label: 'Packer blade operation', type: 'passfail', required: true },
    { id: 'gt7', label: 'Hopper / body lift operation', type: 'passfail', required: true },
    { id: 'gt8', label: 'Tailgate latch & seal', type: 'passfail', required: true },
    { id: 'gt9', label: 'Tire pressure – Front Left (PSI)', type: 'number', required: true, placeholder: '90' },
    { id: 'gt10', label: 'Tire pressure – Front Right (PSI)', type: 'number', required: true, placeholder: '90' },
    { id: 'gt11', label: 'Tire pressure – Rear Left (PSI)', type: 'number', required: true, placeholder: '90' },
    { id: 'gt12', label: 'Tire pressure – Rear Right (PSI)', type: 'number', required: true, placeholder: '90' },
    { id: 'gt13', label: 'Headlights & work lights', type: 'passfail', required: true },
    { id: 'gt14', label: 'Reverse / backup alarm', type: 'passfail', required: true },
    { id: 'gt15', label: 'Brakes', type: 'passfail', required: true },
    { id: 'gt16', label: 'Mirrors (all)', type: 'passfail', required: true },
    { id: 'gt17', label: 'Body leaks / fluid on ground', type: 'yesno', required: true },
    { id: 'gt18', label: 'Fire extinguisher present', type: 'yesno', required: true },
    { id: 'gt19', label: 'Additional notes', type: 'text', required: false, placeholder: 'Any observations...' },
  ]},
]

function seedData() {
  if (!localStorage.getItem(K.users)) save(K.users, [{ id: 'admin1', name: 'Fleet Admin', email: 'admin@fleet.com', password: 'admin123', role: 'admin' }])
  if (!localStorage.getItem(K.vehicles)) save(K.vehicles, [])
  if (!localStorage.getItem(K.submissions)) save(K.submissions, [])
  if (!localStorage.getItem(K.maintenance)) save(K.maintenance, [])
  // Merge any new default templates that don't exist yet
  const existing = load<ChecklistTemplate[]>(K.templates, [])
  if (existing.length === 0) { save(K.templates, DEFAULT_TEMPLATES); return }
  const existingTypes = new Set(existing.map(t => t.vehicleType))
  const merged = [...existing, ...DEFAULT_TEMPLATES.filter(t => !existingTypes.has(t.vehicleType))]
  if (merged.length !== existing.length) save(K.templates, merged)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_LABELS: Record<VehicleType, string> = { truck: 'Semi / Heavy Truck', van: 'Van', trailer: 'Trailer', pickup: 'Pickup Truck', box_truck: 'Box Truck', garbage_truck: 'Garbage Truck' }
const VEHICLE_ICONS: Record<VehicleType, string> = { truck: '🚛', van: '🚐', trailer: '🚛', pickup: '🛻', box_truck: '🚚', garbage_truck: '🚜' }
const STATUS_COLORS: Record<VehicleStatus, string> = { active: 'bg-emerald-100 text-emerald-700', maintenance: 'bg-amber-100 text-amber-700', inactive: 'bg-gray-100 text-gray-500' }
const PRIORITY_COLORS: Record<MaintenancePriority, string> = { low: 'bg-sky-100 text-sky-700', medium: 'bg-amber-100 text-amber-700', high: 'bg-blue-100 text-blue-700', critical: 'bg-red-100 text-red-700' }
const MX_STATUS_COLORS: Record<MaintenanceStatus, string> = { open: 'bg-red-100 text-red-700', in_progress: 'bg-amber-100 text-amber-700', resolved: 'bg-emerald-100 text-emerald-700' }

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-display text-xl font-bold text-gray-900 tracking-wide uppercase">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
const btnPrimary = "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors"
const btnSecondary = "px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded hover:bg-gray-200 transition-colors"
const btnDanger = "px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded hover:bg-red-600 transition-colors"

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const users = load<User[]>(K.users, [])
    const user = users.find(u => u.email === email && u.password === password)
    if (user) onLogin(user)
    else setError('Invalid email or password.')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <span className="text-4xl">🚛</span>
          <span className="font-display text-4xl font-bold text-white tracking-widest uppercase">FleetOps</span>
        </div>
        <p className="text-gray-500 text-sm tracking-wide">Vehicle Inspection & Fleet Management</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 uppercase tracking-wide mb-6">Sign In</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-4">{error}</div>}
        <Field label="Email">
          <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <button type="submit" className={`${btnPrimary} w-full mt-2 py-3`}>Sign In</button>
        <p className="text-xs text-gray-400 text-center mt-4">Admin default: admin@fleet.com / admin123</p>
      </form>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type AdminPage = 'dashboard' | 'vehicles' | 'drivers' | 'templates' | 'submissions' | 'maintenance' | 'settings'
type DriverPage = 'my-vehicles' | 'inspection' | 'my-history' | 'my-maintenance'
type Page = AdminPage | DriverPage

const ADMIN_NAV: { page: AdminPage; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '◈' },
  { page: 'vehicles', label: 'Vehicles', icon: '🚛' },
  { page: 'drivers', label: 'Drivers', icon: '👤' },
  { page: 'templates', label: 'Checklists', icon: '☑' },
  { page: 'submissions', label: 'Submissions', icon: '📋' },
  { page: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { page: 'settings', label: 'Settings', icon: '⚙' },
]

const DRIVER_NAV: { page: DriverPage; label: string; icon: string }[] = [
  { page: 'my-vehicles', label: 'My Vehicles', icon: '🚛' },
  { page: 'inspection', label: 'New Inspection', icon: '☑' },
  { page: 'my-history', label: 'My Reports', icon: '📋' },
  { page: 'my-maintenance', label: 'Maintenance', icon: '🔧' },
]

function Sidebar({ user, page, setPage, onLogout }: { user: User; page: Page; setPage: (p: Page) => void; onLogout: () => void }) {
  const nav = user.role === 'admin' ? ADMIN_NAV : DRIVER_NAV
  return (
    <aside className="w-56 bg-gray-950 flex flex-col shrink-0 min-h-screen">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚛</span>
          <span className="font-display text-xl font-bold text-white tracking-widest uppercase">FleetOps</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(n => (
          <button key={n.page} onClick={() => setPage(n.page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors text-left ${page === n.page ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            <span className="text-base">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="mb-3">
          <p className="text-white text-sm font-semibold truncate">{user.name}</p>
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
          <Badge label={user.role} cls={user.role === 'admin' ? 'bg-blue-900 text-blue-300 mt-1' : 'bg-gray-800 text-gray-400 mt-1'} />
        </div>
        <button onClick={onLogout} className="w-full text-left text-xs text-gray-600 hover:text-gray-400 transition-colors">Sign out</button>
      </div>
    </aside>
  )
}

// ─── Admin: Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ setPage }: { setPage: (p: Page) => void }) {
  const vehicles = load<Vehicle[]>(K.vehicles, [])
  const users = load<User[]>(K.users, []).filter(u => u.role === 'driver')
  const submissions = load<Submission[]>(K.submissions, [])
  const maintenance = load<MaintenanceRequest[]>(K.maintenance, [])
  const openMx = maintenance.filter(m => m.status === 'open').length
  const criticalMx = maintenance.filter(m => m.priority === 'critical' && m.status !== 'resolved').length
  const inMaintenance = vehicles.filter(v => v.status === 'maintenance').length

  const stats = [
    { label: 'Total Vehicles', value: vehicles.length, sub: `${inMaintenance} in maintenance`, action: 'vehicles' as Page, color: 'border-blue-600' },
    { label: 'Drivers', value: users.length, sub: 'registered drivers', action: 'drivers' as Page, color: 'border-sky-500' },
    { label: 'Open Maintenance', value: openMx, sub: `${criticalMx} critical`, action: 'maintenance' as Page, color: criticalMx > 0 ? 'border-red-500' : 'border-amber-500' },
    { label: 'Total Inspections', value: submissions.length, sub: 'all time', action: 'submissions' as Page, color: 'border-emerald-500' },
  ]

  const recentMx = maintenance.filter(m => m.status !== 'resolved').slice(-3).reverse()
  const recentSubs = submissions.slice(-5).reverse()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Fleet overview</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <button key={s.label} onClick={() => setPage(s.action)}
            className={`bg-white rounded-lg border-l-4 ${s.color} p-4 text-left shadow-sm hover:shadow-md transition-shadow`}>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mt-1">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Open Maintenance</h2>
          {recentMx.length === 0 ? <p className="text-gray-400 text-sm">No open requests.</p> : (
            <div className="space-y-3">
              {recentMx.map(m => {
                const v = vehicles.find(v => v.id === m.vehicleId)
                return (
                  <div key={m.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500 truncate">{m.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge label={m.priority} cls={PRIORITY_COLORS[m.priority]} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
          <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Recent Inspections</h2>
          {recentSubs.length === 0 ? <p className="text-gray-400 text-sm">No inspections yet.</p> : (
            <div className="space-y-3">
              {recentSubs.map(s => {
                const v = vehicles.find(v => v.id === s.vehicleId)
                const d = users.find(u => u.id === s.driverId) ?? load<User[]>(K.users, []).find(u => u.id === s.driverId)
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{d?.name ?? 'Unknown driver'} · {new Date(s.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Admin: Vehicles ──────────────────────────────────────────────────────────

function VehiclesView({ currentUser }: { currentUser: User }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => load(K.vehicles, []))
  const [users] = useState<User[]>(() => load<User[]>(K.users, []).filter(u => u.role === 'driver'))
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState({ name: '', type: 'truck' as VehicleType, plate: '', year: '', make: '', model: '', mileage: '', assignedDriverId: '', status: 'active' as VehicleStatus })

  function persist(v: Vehicle[]) { setVehicles(v); save(K.vehicles, v) }

  function openAdd() {
    setForm({ name: '', type: 'truck', plate: '', year: '', make: '', model: '', mileage: '', assignedDriverId: '', status: 'active' })
    setEditing(null); setShowAdd(true)
  }

  function openEdit(v: Vehicle) {
    setForm({ name: v.name, type: v.type, plate: v.plate, year: v.year, make: v.make, model: v.model, mileage: v.mileage, assignedDriverId: v.assignedDriverId ?? '', status: v.status })
    setEditing(v); setShowAdd(true)
  }

  function handleSave() {
    if (!form.name || !form.plate) return
    if (editing) {
      persist(vehicles.map(v => v.id === editing.id ? { ...v, ...form, assignedDriverId: form.assignedDriverId || null } : v))
    } else {
      const newV: Vehicle = { id: uid(), ...form, assignedDriverId: form.assignedDriverId || null, addedAt: new Date().toISOString() }
      persist([...vehicles, newV])
    }
    setShowAdd(false)
  }

  function remove(id: string) {
    if (!confirm('Remove this vehicle? Inspection history is preserved.')) return
    persist(vehicles.filter(v => v.id !== id))
  }

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-1">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in fleet</p>
        </div>
        {currentUser.role === 'admin' && <button onClick={openAdd} className={btnPrimary}>+ Add Vehicle</button>}
      </div>
      {vehicles.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🚛</p>
          <p className="text-gray-500 font-medium">No vehicles yet. Add your first vehicle to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Plate</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Assigned To</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                {currentUser.role === 'admin' && <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => {
                const driver = users.find(u => u.id === v.assignedDriverId)
                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{VEHICLE_ICONS[v.type]}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{v.name}</p>
                          <p className="text-xs text-gray-400">{v.year} {v.make} {v.model} · {VEHICLE_LABELS[v.type]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-mono hidden sm:table-cell">{v.plate}</td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{driver?.name ?? <span className="text-gray-400 italic">Unassigned</span>}</td>
                    <td className="px-5 py-3"><Badge label={v.status} cls={STATUS_COLORS[v.status]} /></td>
                    {currentUser.role === 'admin' && (
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => openEdit(v)} className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3">Edit</button>
                        <button onClick={() => remove(v.id)} className="text-red-400 hover:text-red-600 font-medium text-xs">Remove</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title={editing ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setShowAdd(false)}>
          <Field label="Vehicle Name / Unit #"><input className={inputCls} value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Truck 01" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={e => f('type', e.target.value as VehicleType)}>
                {(Object.entries(VEHICLE_LABELS) as [VehicleType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={e => f('status', e.target.value as VehicleStatus)}>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="License Plate"><input className={inputCls} value={form.plate} onChange={e => f('plate', e.target.value)} placeholder="ABC-1234" /></Field>
            <Field label="Year"><input className={inputCls} value={form.year} onChange={e => f('year', e.target.value)} placeholder="2022" /></Field>
            <Field label="Mileage"><input className={inputCls} value={form.mileage} onChange={e => f('mileage', e.target.value)} placeholder="45000" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make"><input className={inputCls} value={form.make} onChange={e => f('make', e.target.value)} placeholder="Freightliner" /></Field>
            <Field label="Model"><input className={inputCls} value={form.model} onChange={e => f('model', e.target.value)} placeholder="Cascadia" /></Field>
          </div>
          <Field label="Assign Driver">
            <select className={inputCls} value={form.assignedDriverId} onChange={e => f('assignedDriverId', e.target.value)}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 mt-2">
            <button onClick={handleSave} className={btnPrimary}>Save Vehicle</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Drivers ───────────────────────────────────────────────────────────

function DriversView() {
  const [users, setUsers] = useState<User[]>(() => load<User[]>(K.users, []))
  const drivers = users.filter(u => u.role === 'driver')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const vehicles = load<Vehicle[]>(K.vehicles, [])

  function persist(u: User[]) { setUsers(u); save(K.users, u) }

  function handleSave() {
    if (!form.name || !form.email || !form.password) { setError('All fields required.'); return }
    if (users.find(u => u.email === form.email)) { setError('Email already in use.'); return }
    persist([...users, { id: uid(), name: form.name, email: form.email, password: form.password, role: 'driver' }])
    setForm({ name: '', email: '', password: '' }); setError(''); setShowAdd(false)
  }

  function remove(id: string) {
    if (!confirm("Remove this driver account?")) return
    persist(users.filter(u => u.id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Drivers</h1>
          <p className="text-gray-500 text-sm mt-1">{drivers.length} driver account{drivers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError('') }} className={btnPrimary}>+ Add Driver</button>
      </div>
      {drivers.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-500 font-medium">No drivers yet. Add a driver to let them access the app.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Assigned Vehicles</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map(d => {
                const assigned = vehicles.filter(v => v.assignedDriverId === d.id)
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-semibold text-gray-900">{d.name}</td>
                    <td className="px-5 py-3 text-gray-600">{d.email}</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {assigned.length === 0 ? <span className="text-gray-400 italic text-xs">None assigned</span> :
                        assigned.map(v => <span key={v.id} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1">{v.name}</span>)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(d.id)} className="text-red-400 hover:text-red-600 font-medium text-xs">Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Driver" onClose={() => setShowAdd(false)}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-3">{error}</div>}
          <Field label="Full Name"><input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@company.com" /></Field>
          <Field label="Password"><input className={inputCls} type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Set a password for them" /></Field>
          <p className="text-xs text-gray-400 mb-4">Share the email and password with the driver so they can sign in.</p>
          <div className="flex gap-3">
            <button onClick={handleSave} className={btnPrimary}>Create Account</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Checklist Templates ───────────────────────────────────────────────

function TemplatesView() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(() => load(K.templates, DEFAULT_TEMPLATES))
  const [selectedType, setSelectedType] = useState<VehicleType>('truck')
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({ label: '', type: 'passfail' as ChecklistItemType, required: true, placeholder: '' })

  const template = templates.find(t => t.vehicleType === selectedType) ?? { vehicleType: selectedType, items: [] }

  function persist(t: ChecklistTemplate[]) { setTemplates(t); save(K.templates, t) }

  function updateTemplate(items: ChecklistItem[]) {
    const updated = templates.find(t => t.vehicleType === selectedType)
      ? templates.map(t => t.vehicleType === selectedType ? { ...t, items } : t)
      : [...templates, { vehicleType: selectedType, items }]
    persist(updated)
  }

  function addItem() {
    if (!newItem.label) return
    updateTemplate([...template.items, { id: uid(), ...newItem }])
    setNewItem({ label: '', type: 'passfail', required: true, placeholder: '' }); setShowAddItem(false)
  }

  function removeItem(id: string) { updateTemplate(template.items.filter(i => i.id !== id)) }

  const TYPE_LABELS: Record<ChecklistItemType, string> = { yesno: 'Yes / No', passfail: 'Pass / Fail', number: 'Number', text: 'Text' }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Checklist Templates</h1>
        <p className="text-gray-500 text-sm mt-1">Configure what drivers inspect per vehicle type</p>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.entries(VEHICLE_LABELS) as [VehicleType, string][]).map(([k, v]) => (
          <button key={k} onClick={() => setSelectedType(k)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${selectedType === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'}`}>
            {VEHICLE_ICONS[k]} {v}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{VEHICLE_LABELS[selectedType]} — {template.items.length} items</h2>
          <button onClick={() => setShowAddItem(true)} className={btnPrimary}>+ Add Item</button>
        </div>
        {template.items.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No checklist items. Add some above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {template.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                <span className="text-gray-400 text-xs w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  {item.placeholder && <p className="text-xs text-gray-400">Placeholder: {item.placeholder}</p>}
                </div>
                <Badge label={TYPE_LABELS[item.type]} cls="bg-gray-100 text-gray-600" />
                {item.required && <Badge label="Required" cls="bg-blue-50 text-blue-600" />}
                <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs font-medium ml-2">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddItem && (
        <Modal title="Add Checklist Item" onClose={() => setShowAddItem(false)}>
          <Field label="Item Label"><input className={inputCls} value={newItem.label} onChange={e => setNewItem(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Engine oil level" /></Field>
          <Field label="Input Type">
            <select className={inputCls} value={newItem.type} onChange={e => setNewItem(p => ({ ...p, type: e.target.value as ChecklistItemType }))}>
              <option value="passfail">Pass / Fail</option>
              <option value="yesno">Yes / No</option>
              <option value="number">Number</option>
              <option value="text">Text</option>
            </select>
          </Field>
          {(newItem.type === 'number' || newItem.type === 'text') && (
            <Field label="Placeholder (optional)"><input className={inputCls} value={newItem.placeholder} onChange={e => setNewItem(p => ({ ...p, placeholder: e.target.value }))} placeholder="e.g. 110" /></Field>
          )}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={newItem.required} onChange={e => setNewItem(p => ({ ...p, required: e.target.checked }))} className="accent-blue-600" />
            <span className="text-sm text-gray-700 font-medium">Required</span>
          </label>
          <div className="flex gap-3">
            <button onClick={addItem} className={btnPrimary}>Add Item</button>
            <button onClick={() => setShowAddItem(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Submissions ────────────────────────────────────────────────────────

function SubmissionsView() {
  const submissions = load<Submission[]>(K.submissions, []).slice().reverse()
  const vehicles = load<Vehicle[]>(K.vehicles, [])
  const users = load<User[]>(K.users, [])
  const templates = load<ChecklistTemplate[]>(K.templates, DEFAULT_TEMPLATES)
  const [selected, setSelected] = useState<Submission | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Inspection Reports</h1>
        <p className="text-gray-500 text-sm mt-1">{submissions.length} total submissions</p>
      </div>
      {submissions.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No inspection reports yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Driver</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Odometer</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map(s => {
                const v = vehicles.find(v => v.id === s.vehicleId)
                const d = users.find(u => u.id === s.driverId)
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-semibold text-gray-900">{v?.name ?? 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">{d?.name ?? 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-600">{new Date(s.date).toLocaleDateString()} {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{s.odometer ? s.odometer + ' mi' : '—'}</td>
                    <td className="px-5 py-3 text-right"><button onClick={() => setSelected(s)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">View</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (() => {
        const v = vehicles.find(v => v.id === selected.vehicleId)
        const tmpl = templates.find(t => t.vehicleType === v?.type)
        return (
          <Modal title={`Inspection — ${v?.name ?? 'Vehicle'}`} onClose={() => setSelected(null)}>
            <p className="text-xs text-gray-500 mb-4">{new Date(selected.date).toLocaleString()} · Odometer: {selected.odometer || '—'}</p>
            <div className="space-y-2 mb-4">
              {selected.items.map(si => {
                const item = tmpl?.items.find(i => i.id === si.itemId)
                return (
                  <div key={si.itemId} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{item?.label ?? si.itemId}</span>
                    <span className={`text-sm font-semibold ${si.value === 'Pass' || si.value === 'Yes' ? 'text-emerald-600' : si.value === 'Fail' || si.value === 'No' ? 'text-red-600' : 'text-gray-900'}`}>{si.value || '—'}</span>
                  </div>
                )
              })}
            </div>
            {selected.notes && <div className="bg-gray-50 rounded p-3 text-sm text-gray-700"><span className="font-semibold text-gray-900">Notes: </span>{selected.notes}</div>}
          </Modal>
        )
      })()}
    </div>
  )
}

// ─── Admin: Maintenance ────────────────────────────────────────────────────────

function MaintenanceAdminView() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => load(K.maintenance, []))
  const vehicles = load<Vehicle[]>(K.vehicles, [])
  const users = load<User[]>(K.users, [])
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<MaintenanceStatus>('open')
  const [filter, setFilter] = useState<'all' | MaintenanceStatus>('all')

  function persist(r: MaintenanceRequest[]) { setRequests(r); save(K.maintenance, r) }

  function openDetail(r: MaintenanceRequest) { setSelected(r); setNotes(r.adminNotes); setStatus(r.status) }

  function saveDetail() {
    if (!selected) return
    persist(requests.map(r => r.id === selected.id ? { ...r, status, adminNotes: notes } : r))
    setSelected(null)
  }

  const filtered = filter === 'all' ? requests.slice().reverse() : requests.filter(r => r.status === filter).slice().reverse()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Maintenance Requests</h1>
        <p className="text-gray-500 text-sm mt-1">{requests.filter(r => r.status !== 'resolved').length} open</p>
      </div>
      <div className="flex gap-2 mb-5">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'}`}>
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-gray-500 font-medium">No maintenance requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const v = vehicles.find(v => v.id === r.vehicleId)
            const d = users.find(u => u.id === r.driverId)
            return (
              <div key={r.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(r)}>
                <div className="text-2xl">{v ? VEHICLE_ICONS[v.type] : '🔧'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{v?.name ?? 'Unknown vehicle'}</span>
                    <Badge label={r.priority} cls={PRIORITY_COLORS[r.priority]} />
                    <Badge label={r.status === 'in_progress' ? 'In Progress' : r.status} cls={MX_STATUS_COLORS[r.status]} />
                  </div>
                  <p className="text-sm text-gray-700 truncate">{r.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{d?.name ?? 'Unknown'} · {new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className="text-blue-600 text-xs font-medium shrink-0">Update →</span>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal title="Update Request" onClose={() => setSelected(null)}>
          <div className="bg-gray-50 rounded p-3 mb-4">
            <p className="font-semibold text-gray-900 text-sm">{vehicles.find(v => v.id === selected.vehicleId)?.name}</p>
            <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge label={selected.priority} cls={PRIORITY_COLORS[selected.priority]} />
              <span className="text-xs text-gray-400">{new Date(selected.date).toLocaleString()}</span>
            </div>
          </div>
          <Field label="Status">
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as MaintenanceStatus)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </Field>
          <Field label="Admin Notes">
            <textarea className={`${inputCls} h-24 resize-none`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for the driver or your records..." />
          </Field>
          <div className="flex gap-3">
            <button onClick={saveDetail} className={btnPrimary}>Save</button>
            <button onClick={() => setSelected(null)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Driver: My Vehicles ───────────────────────────────────────────────────────

function MyVehiclesView({ user, setPage }: { user: User; setPage: (p: Page) => void }) {
  const vehicles = load<Vehicle[]>(K.vehicles, []).filter(v => v.assignedDriverId === user.id)
  const maintenance = load<MaintenanceRequest[]>(K.maintenance, []).filter(m => m.vehicleId && vehicles.some(v => v.id === m.vehicleId) && m.status !== 'resolved')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">My Vehicles</h1>
        <p className="text-gray-500 text-sm mt-1">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} assigned to you</p>
      </div>
      {vehicles.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🚛</p>
          <p className="text-gray-500 font-medium">No vehicles assigned yet. Ask your fleet admin to assign vehicles to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => {
            const openMx = maintenance.filter(m => m.vehicleId === v.id).length
            return (
              <div key={v.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{VEHICLE_ICONS[v.type]}</span>
                  <Badge label={v.status} cls={STATUS_COLORS[v.status]} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{v.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{v.year} {v.make} {v.model}</p>
                <p className="text-xs text-gray-400 mt-0.5">{VEHICLE_LABELS[v.type]} · {v.plate}</p>
                {v.mileage && <p className="text-xs text-gray-400">Mileage: {v.mileage}</p>}
                {openMx > 0 && <div className="mt-3 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs text-amber-700 font-medium">{openMx} open maintenance request{openMx > 1 ? 's' : ''}</div>}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setPage('inspection')} className={`${btnPrimary} text-xs py-1.5`}>Start Inspection</button>
                  <button onClick={() => setPage('my-maintenance')} className={`${btnSecondary} text-xs py-1.5`}>Report Issue</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Driver: Inspection ────────────────────────────────────────────────────────

function InspectionView({ user }: { user: User }) {
  const vehicles = load<Vehicle[]>(K.vehicles, []).filter(v => v.assignedDriverId === user.id)
  const templates = load<ChecklistTemplate[]>(K.templates, DEFAULT_TEMPLATES)
  const [selectedVehicle, setSelectedVehicle] = useState<string>(vehicles[0]?.id ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [odometer, setOdometer] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const vehicle = vehicles.find(v => v.id === selectedVehicle)
  const template = templates.find(t => t.vehicleType === vehicle?.type)

  function setAnswer(id: string, val: string) { setAnswers(p => ({ ...p, [id]: val })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle || !template) return
    const sub: Submission = {
      id: uid(), vehicleId: vehicle.id, driverId: user.id, date: new Date().toISOString(),
      items: template.items.map(i => ({ itemId: i.id, value: answers[i.id] ?? '' })),
      notes, odometer
    }
    const existing = load<Submission[]>(K.submissions, [])
    save(K.submissions, [...existing, sub])
    setSubmitted(true)
  }

  function reset() { setAnswers({}); setOdometer(''); setNotes(''); setSubmitted(false) }

  if (submitted) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
        <h2 className="font-display text-2xl font-bold text-gray-900 uppercase tracking-wide mb-2">Inspection Submitted</h2>
        <p className="text-gray-500 mb-6">Your inspection report has been saved.</p>
        <button onClick={reset} className={btnPrimary}>Start Another</button>
      </div>
    </div>
  )

  if (vehicles.length === 0) return (
    <div className="p-6 text-center py-24">
      <p className="text-4xl mb-3">🚛</p>
      <p className="text-gray-500">No vehicles assigned to you. Contact your fleet admin.</p>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">New Inspection</h1>
        <p className="text-gray-500 text-sm mt-1">Complete a pre-trip or routine inspection</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
          <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">Vehicle</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Select Vehicle">
              <select className={inputCls} value={selectedVehicle} onChange={e => { setSelectedVehicle(e.target.value); setAnswers({}) }}>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
              </select>
            </Field>
            <Field label="Odometer Reading (mi)">
              <input className={inputCls} type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="e.g. 45230" />
            </Field>
          </div>
        </div>

        {template && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide">{VEHICLE_LABELS[vehicle!.type]} Checklist</h2>
              <p className="text-xs text-gray-500 mt-0.5">{template.items.length} items</p>
            </div>
            <div className="divide-y divide-gray-50">
              {template.items.map(item => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.label}
                        {item.required && <span className="text-red-400 ml-1">*</span>}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {(item.type === 'passfail' || item.type === 'yesno') && (
                        <div className="flex gap-1">
                          {(item.type === 'passfail' ? ['Pass', 'Fail'] : ['Yes', 'No']).map(opt => (
                            <button key={opt} type="button" onClick={() => setAnswer(item.id, opt)}
                              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${answers[item.id] === opt
                                ? opt === 'Pass' || opt === 'Yes' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {item.type === 'number' && (
                        <input type="number" className={`${inputCls} w-28`} value={answers[item.id] ?? ''} onChange={e => setAnswer(item.id, e.target.value)} placeholder={item.placeholder} />
                      )}
                      {item.type === 'text' && (
                        <input type="text" className={`${inputCls} w-48`} value={answers[item.id] ?? ''} onChange={e => setAnswer(item.id, e.target.value)} placeholder={item.placeholder} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
          <Field label="Additional Notes">
            <textarea className={`${inputCls} h-24 resize-none`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations, concerns, or remarks..." />
          </Field>
        </div>

        <button type="submit" className={`${btnPrimary} py-3 w-full text-base`}>Submit Inspection Report</button>
      </form>
    </div>
  )
}

// ─── Driver: My History ────────────────────────────────────────────────────────

function MyHistoryView({ user }: { user: User }) {
  const submissions = load<Submission[]>(K.submissions, []).filter(s => s.driverId === user.id).slice().reverse()
  const vehicles = load<Vehicle[]>(K.vehicles, [])
  const templates = load<ChecklistTemplate[]>(K.templates, DEFAULT_TEMPLATES)
  const [selected, setSelected] = useState<Submission | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">My Reports</h1>
        <p className="text-gray-500 text-sm mt-1">{submissions.length} inspection{submissions.length !== 1 ? 's' : ''} submitted</p>
      </div>
      {submissions.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No inspection reports yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map(s => {
            const v = vehicles.find(v => v.id === s.vehicleId)
            return (
              <div key={s.id} className="bg-white rounded-lg border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(s)}>
                <span className="text-2xl">{v ? VEHICLE_ICONS[v.type] : '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{v?.name ?? 'Unknown vehicle'}</p>
                  <p className="text-xs text-gray-500">{new Date(s.date).toLocaleString()} {s.odometer && `· ${s.odometer} mi`}</p>
                </div>
                <span className="text-blue-600 text-xs font-medium">View →</span>
              </div>
            )
          })}
        </div>
      )}

      {selected && (() => {
        const v = vehicles.find(v => v.id === selected.vehicleId)
        const tmpl = templates.find(t => t.vehicleType === v?.type)
        return (
          <Modal title={`Inspection — ${v?.name ?? 'Vehicle'}`} onClose={() => setSelected(null)}>
            <p className="text-xs text-gray-500 mb-4">{new Date(selected.date).toLocaleString()} · Odometer: {selected.odometer || '—'}</p>
            <div className="space-y-2 mb-4">
              {selected.items.map(si => {
                const item = tmpl?.items.find(i => i.id === si.itemId)
                return (
                  <div key={si.itemId} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{item?.label ?? si.itemId}</span>
                    <span className={`text-sm font-semibold ${si.value === 'Pass' || si.value === 'Yes' ? 'text-emerald-600' : si.value === 'Fail' || si.value === 'No' ? 'text-red-600' : 'text-gray-900'}`}>{si.value || '—'}</span>
                  </div>
                )
              })}
            </div>
            {selected.notes && <div className="bg-gray-50 rounded p-3 text-sm text-gray-700"><span className="font-semibold text-gray-900">Notes: </span>{selected.notes}</div>}
          </Modal>
        )
      })()}
    </div>
  )
}

// ─── Driver: Maintenance ───────────────────────────────────────────────────────

function MyMaintenanceView({ user }: { user: User }) {
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => load(K.maintenance, []).filter((m: MaintenanceRequest) => m.driverId === user.id))
  const vehicles = load<Vehicle[]>(K.vehicles, []).filter(v => v.assignedDriverId === user.id)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ vehicleId: vehicles[0]?.id ?? '', description: '', priority: 'medium' as MaintenancePriority })

  function handleSubmit() {
    if (!form.vehicleId || !form.description) return
    const req: MaintenanceRequest = { id: uid(), vehicleId: form.vehicleId, driverId: user.id, date: new Date().toISOString(), description: form.description, status: 'open', priority: form.priority, adminNotes: '' }
    const all = load<MaintenanceRequest[]>(K.maintenance, [])
    save(K.maintenance, [...all, req])
    setRequests([req, ...requests])
    setForm({ vehicleId: vehicles[0]?.id ?? '', description: '', priority: 'medium' }); setShowAdd(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Maintenance</h1>
          <p className="text-gray-500 text-sm mt-1">Report issues with your vehicles</p>
        </div>
        <button onClick={() => setShowAdd(true)} className={btnPrimary} disabled={vehicles.length === 0}>+ Report Issue</button>
      </div>
      {requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-gray-500 font-medium">No maintenance requests. Use the button above to report an issue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.slice().reverse().map(r => {
            const v = vehicles.find(v => v.id === r.vehicleId) ?? load<Vehicle[]>(K.vehicles, []).find(v => v.id === r.vehicleId)
            return (
              <div key={r.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{v ? VEHICLE_ICONS[v.type] : '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{v?.name ?? 'Unknown vehicle'}</span>
                      <Badge label={r.priority} cls={PRIORITY_COLORS[r.priority]} />
                      <Badge label={r.status === 'in_progress' ? 'In Progress' : r.status} cls={MX_STATUS_COLORS[r.status]} />
                    </div>
                    <p className="text-sm text-gray-700">{r.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.date).toLocaleDateString()}</p>
                    {r.adminNotes && <div className="mt-2 bg-sky-50 border border-sky-100 rounded px-3 py-2 text-xs text-sky-700"><span className="font-semibold">Admin: </span>{r.adminNotes}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="Report Maintenance Issue" onClose={() => setShowAdd(false)}>
          <Field label="Vehicle">
            <select className={inputCls} value={form.vehicleId} onChange={e => setForm(p => ({ ...p, vehicleId: e.target.value }))}>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as MaintenancePriority }))}>
              <option value="low">Low — Monitor, not urgent</option>
              <option value="medium">Medium — Needs attention soon</option>
              <option value="high">High — Address before next trip</option>
              <option value="critical">Critical — Vehicle unsafe to operate</option>
            </select>
          </Field>
          <Field label="Description">
            <textarea className={`${inputCls} h-28 resize-none`} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issue in detail..." />
          </Field>
          <div className="flex gap-3">
            <button onClick={handleSubmit} className={btnPrimary}>Submit Request</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Settings ─────────────────────────────────────────────────────────

function AdminSettingsView({ currentUser, onUserUpdate }: { currentUser: User; onUserUpdate: (u: User) => void }) {
  const [users, setUsers] = useState<User[]>(() => load<User[]>(K.users, []))
  const admins = users.filter(u => u.role === 'admin')

  // My credentials
  const [myForm, setMyForm] = useState({ name: currentUser.name, email: currentUser.email, password: '', confirmPassword: '' })
  const [myMsg, setMyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Add admin
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' })
  const [addError, setAddError] = useState('')

  function persist(u: User[]) { setUsers(u); save(K.users, u) }

  function saveMyCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!myForm.name || !myForm.email) { setMyMsg({ type: 'err', text: 'Name and email are required.' }); return }
    if (myForm.password && myForm.password !== myForm.confirmPassword) { setMyMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    if (myForm.email !== currentUser.email && users.find(u => u.id !== currentUser.id && u.email === myForm.email)) {
      setMyMsg({ type: 'err', text: 'That email is already in use.' }); return
    }
    const updated = users.map(u => u.id === currentUser.id
      ? { ...u, name: myForm.name, email: myForm.email, ...(myForm.password ? { password: myForm.password } : {}) }
      : u)
    persist(updated)
    const updatedUser = updated.find(u => u.id === currentUser.id)!
    onUserUpdate(updatedUser)
    setMyForm(p => ({ ...p, password: '', confirmPassword: '' }))
    setMyMsg({ type: 'ok', text: 'Credentials updated successfully.' })
  }

  function addAdmin() {
    if (!addForm.name || !addForm.email || !addForm.password) { setAddError('All fields required.'); return }
    if (users.find(u => u.email === addForm.email)) { setAddError('Email already in use.'); return }
    persist([...users, { id: uid(), name: addForm.name, email: addForm.email, password: addForm.password, role: 'admin' }])
    setAddForm({ name: '', email: '', password: '' }); setAddError(''); setShowAdd(false)
  }

  function removeAdmin(id: string) {
    if (id === currentUser.id) return
    if (!confirm('Remove this admin account?')) return
    persist(users.filter(u => u.id !== id))
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage credentials and admin accounts</p>
      </div>

      {/* My Credentials */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide">My Credentials</h2>
          <p className="text-xs text-gray-500 mt-0.5">Update your own name, email, or password</p>
        </div>
        <form onSubmit={saveMyCredentials} className="px-6 py-5 space-y-0">
          {myMsg && (
            <div className={`mb-4 text-sm rounded px-3 py-2 border ${myMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{myMsg.text}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name">
              <input className={inputCls} value={myForm.name} onChange={e => setMyForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={myForm.email} onChange={e => setMyForm(p => ({ ...p, email: e.target.value }))} placeholder="you@company.com" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="New Password">
              <input className={inputCls} type="password" value={myForm.password} onChange={e => setMyForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep current" />
            </Field>
            <Field label="Confirm Password">
              <input className={inputCls} type="password" value={myForm.confirmPassword} onChange={e => setMyForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Re-enter new password" />
            </Field>
          </div>
          <button type="submit" className={btnPrimary}>Save Changes</button>
        </form>
      </div>

      {/* Admin Accounts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide">Admin Accounts</h2>
            <p className="text-xs text-gray-500 mt-0.5">{admins.length} admin{admins.length !== 1 ? 's' : ''} — all have full access</p>
          </div>
          <button onClick={() => { setShowAdd(true); setAddError('') }} className={btnPrimary}>+ Add Admin</button>
        </div>
        <div className="divide-y divide-gray-50">
          {admins.map(a => (
            <div key={a.id} className="flex items-center gap-4 px-6 py-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {a.name}
                  {a.id === currentUser.id && <span className="ml-2 text-xs text-blue-600 font-normal">(you)</span>}
                </p>
                <p className="text-xs text-gray-500 truncate">{a.email}</p>
              </div>
              {a.id !== currentUser.id && (
                <button onClick={() => removeAdmin(a.id)} className="text-red-400 hover:text-red-600 text-xs font-medium shrink-0">Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <Modal title="Add Admin Account" onClose={() => setShowAdd(false)}>
          {addError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-3">{addError}</div>}
          <Field label="Full Name"><input className={inputCls} value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></Field>
          <Field label="Password"><input className={inputCls} type="text" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder="Set their password" /></Field>
          <p className="text-xs text-gray-400 mb-4">This person will have full admin access. Share the credentials with them.</p>
          <div className="flex gap-3">
            <button onClick={addAdmin} className={btnPrimary}>Create Admin</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => { seedData() }, [])
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { const s = sessionStorage.getItem('fleet_session'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [page, setPage] = useState<Page>(() => currentUser?.role === 'admin' ? 'dashboard' : 'my-vehicles')

  function handleLogin(user: User) {
    setCurrentUser(user)
    sessionStorage.setItem('fleet_session', JSON.stringify(user))
    setPage(user.role === 'admin' ? 'dashboard' : 'my-vehicles')
  }

  function handleLogout() {
    setCurrentUser(null)
    sessionStorage.removeItem('fleet_session')
  }

  function handleUserUpdate(updated: User) {
    setCurrentUser(updated)
    sessionStorage.setItem('fleet_session', JSON.stringify(updated))
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />

  function renderPage() {
    if (!currentUser) return null
    if (currentUser.role === 'admin') {
      if (page === 'dashboard') return <AdminDashboard setPage={setPage} />
      if (page === 'vehicles') return <VehiclesView currentUser={currentUser} />
      if (page === 'drivers') return <DriversView />
      if (page === 'templates') return <TemplatesView />
      if (page === 'submissions') return <SubmissionsView />
      if (page === 'maintenance') return <MaintenanceAdminView />
      if (page === 'settings') return <AdminSettingsView currentUser={currentUser} onUserUpdate={handleUserUpdate} />
    } else {
      if (page === 'my-vehicles') return <MyVehiclesView user={currentUser} setPage={setPage} />
      if (page === 'inspection') return <InspectionView user={currentUser} />
      if (page === 'my-history') return <MyHistoryView user={currentUser} />
      if (page === 'my-maintenance') return <MyMaintenanceView user={currentUser} />
    }
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={currentUser} page={page} setPage={setPage} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto min-h-screen">
        {renderPage()}
      </main>
    </div>
  )
}
