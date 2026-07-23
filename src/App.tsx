import { useState, useEffect, useCallback } from 'react'
import { auth, me as meApi, fleet as fleetApi } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'admin' | 'driver'
type VehicleType = 'truck' | 'van' | 'trailer' | 'pickup' | 'box_truck' | 'garbage_truck'
type VehicleStatus = 'active' | 'maintenance' | 'inactive'
type ChecklistItemType = 'yesno' | 'number' | 'text' | 'passfail'
type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'
type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical'

interface User { id: string; username: string; name: string; email: string; role: Role; fleetId: string }
interface Fleet { id: string; name: string; inviteCode: string }
interface Vehicle { id: string; name: string; type: VehicleType; plate: string; year: string; make: string; model: string; assignedDriverId: string | null; status: VehicleStatus; mileage: string; addedAt: string }
interface ChecklistItem { id: string; label: string; type: ChecklistItemType; required: boolean; placeholder?: string }
interface ChecklistTemplate { vehicleType: VehicleType; items: ChecklistItem[] }
interface SubmissionItem { itemId: string; value: string }
interface Submission { id: string; vehicleId: string; driverId: string; date: string; items: SubmissionItem[]; notes: string; odometer: string }
interface MaintenanceRequest { id: string; vehicleId: string; driverId: string; date: string; description: string; status: MaintenanceStatus; priority: MaintenancePriority; adminNotes: string }

interface FleetData {
  fleet: Fleet
  members: User[]
  vehicles: Vehicle[]
  templates: ChecklistTemplate[]
  submissions: Submission[]
  maintenance: MaintenanceRequest[]
}

// ─── Session storage ──────────────────────────────────────────────────────────

const LS = {
  get token() { return localStorage.getItem('fleet_token') ?? '' },
  set token(v: string) { v ? localStorage.setItem('fleet_token', v) : localStorage.removeItem('fleet_token') },
  get user(): User | null { try { const r = localStorage.getItem('fleet_user'); return r ? JSON.parse(r) : null } catch { return null } },
  set user(v: User | null) { v ? localStorage.setItem('fleet_user', JSON.stringify(v)) : localStorage.removeItem('fleet_user') },
}

const uid = () => Math.random().toString(36).slice(2, 10)

// ─── Default templates ────────────────────────────────────────────────────────

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

function Spinner() {
  return <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
}

const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
const btnPrimary = "px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const btnSecondary = "px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded hover:bg-gray-200 transition-colors"

// ─── Auth Screens ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, onGoSignup }: { onLogin: (token: string, user: User) => void; onGoSignup: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await auth.login(email, password)
      onLogin(data.token, data.user)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
          <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
        </Field>
        <button type="submit" disabled={loading} className={`${btnPrimary} w-full mt-2 py-3 flex items-center justify-center gap-2`}>
          {loading && <Spinner />} Sign In
        </button>
        <p className="text-sm text-gray-500 text-center mt-5">
          No account?{' '}
          <button type="button" onClick={onGoSignup} className="text-blue-600 font-semibold hover:underline">Create one</button>
        </p>
      </form>
    </div>
  )
}

function SignupScreen({ onSignup, onGoLogin }: { onSignup: (token: string, user: User) => void; onGoLogin: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', fleetName: '', inviteCode: '' })
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const data = await auth.signup({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(mode === 'create' ? { fleetName: form.fleetName.trim() || undefined } : { inviteCode: form.inviteCode.trim() }),
      })
      onSignup(data.token, data.user)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <span className="text-4xl">🚛</span>
          <span className="font-display text-4xl font-bold text-white tracking-widest uppercase">FleetOps</span>
        </div>
        <p className="text-gray-500 text-sm tracking-wide">Vehicle Inspection & Fleet Management</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 uppercase tracking-wide mb-6">Create Account</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-4">{error}</div>}

        <Field label="Username">
          <input className={inputCls} value={form.username} onChange={e => f('username', e.target.value)} placeholder="e.g. johnfleet" required autoComplete="username" />
          <p className="text-xs text-gray-400 mt-1">Letters, numbers, underscores only</p>
        </Field>
        <Field label="Email Address">
          <input className={inputCls} type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="you@company.com" required autoComplete="email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password">
            <input className={inputCls} type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min. 6 characters" required autoComplete="new-password" />
          </Field>
          <Field label="Confirm Password">
            <input className={inputCls} type="password" value={form.confirm} onChange={e => f('confirm', e.target.value)} placeholder="Re-enter" required autoComplete="new-password" />
          </Field>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account Type</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('create')}
              className={`py-2.5 px-3 rounded border text-sm font-medium transition-colors ${mode === 'create' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
              Create a Fleet
              <p className={`text-xs mt-0.5 font-normal ${mode === 'create' ? 'text-blue-100' : 'text-gray-400'}`}>You'll be the admin</p>
            </button>
            <button type="button" onClick={() => setMode('join')}
              className={`py-2.5 px-3 rounded border text-sm font-medium transition-colors ${mode === 'join' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
              Join a Fleet
              <p className={`text-xs mt-0.5 font-normal ${mode === 'join' ? 'text-blue-100' : 'text-gray-400'}`}>Enter invite code</p>
            </button>
          </div>
        </div>

        {mode === 'create' && (
          <Field label="Fleet Name (optional)">
            <input className={inputCls} value={form.fleetName} onChange={e => f('fleetName', e.target.value)} placeholder="e.g. Acme Waste Services" />
          </Field>
        )}
        {mode === 'join' && (
          <Field label="Fleet Invite Code">
            <input className={inputCls} value={form.inviteCode} onChange={e => f('inviteCode', e.target.value.toUpperCase())} placeholder="e.g. A1B2C3" required={mode === 'join'} style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }} />
            <p className="text-xs text-gray-400 mt-1">Ask your fleet admin for the invite code</p>
          </Field>
        )}

        <button type="submit" disabled={loading} className={`${btnPrimary} w-full py-3 mt-2 flex items-center justify-center gap-2`}>
          {loading && <Spinner />} Create Account
        </button>
        <p className="text-sm text-gray-500 text-center mt-5">
          Already have an account?{' '}
          <button type="button" onClick={onGoLogin} className="text-blue-600 font-semibold hover:underline">Sign in</button>
        </p>
      </form>
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">{message}</p>
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
          <p className="text-white text-sm font-semibold truncate">@{user.username}</p>
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
          <Badge label={user.role} cls={user.role === 'admin' ? 'bg-blue-900 text-blue-300 mt-1' : 'bg-gray-800 text-gray-400 mt-1'} />
        </div>
        <button onClick={onLogout} className="w-full text-left text-xs text-gray-600 hover:text-gray-400 transition-colors">Sign out</button>
      </div>
    </aside>
  )
}

// ─── Admin: Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ data, setPage }: { data: FleetData; setPage: (p: Page) => void }) {
  const { vehicles, members, submissions, maintenance } = data
  const drivers = members.filter(u => u.role === 'driver')
  const openMx = maintenance.filter(m => m.status === 'open').length
  const criticalMx = maintenance.filter(m => m.priority === 'critical' && m.status !== 'resolved').length
  const inMaintenance = vehicles.filter(v => v.status === 'maintenance').length

  const stats = [
    { label: 'Total Vehicles', value: vehicles.length, sub: `${inMaintenance} in maintenance`, action: 'vehicles' as Page, color: 'border-blue-600' },
    { label: 'Drivers', value: drivers.length, sub: 'registered', action: 'drivers' as Page, color: 'border-sky-500' },
    { label: 'Open Maintenance', value: openMx, sub: `${criticalMx} critical`, action: 'maintenance' as Page, color: criticalMx > 0 ? 'border-red-500' : 'border-amber-500' },
    { label: 'Total Inspections', value: submissions.length, sub: 'all time', action: 'submissions' as Page, color: 'border-emerald-500' },
  ]

  const recentMx = maintenance.filter(m => m.status !== 'resolved').slice(-3).reverse()
  const recentSubs = submissions.slice(-5).reverse()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">{data.fleet.name}</h1>
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
                    <Badge label={m.priority} cls={PRIORITY_COLORS[m.priority]} />
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
                const d = members.find(u => u.id === s.driverId)
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{d?.name ?? 'Unknown'} · {new Date(s.date).toLocaleDateString()}</p>
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

function VehiclesView({ data, token, onUpdate }: { data: FleetData; token: string; onUpdate: (v: Vehicle[]) => void }) {
  const { vehicles, members, fleet } = data
  const drivers = members.filter(u => u.role === 'driver')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'truck' as VehicleType, plate: '', year: '', make: '', model: '', mileage: '', assignedDriverId: '', status: 'active' as VehicleStatus })

  async function persist(updated: Vehicle[]) {
    setSaving(true)
    try { await fleetApi.saveVehicles(token, fleet.id, updated); onUpdate(updated) }
    catch { alert('Failed to save. Try again.') }
    finally { setSaving(false) }
  }

  function openAdd() { setForm({ name: '', type: 'truck', plate: '', year: '', make: '', model: '', mileage: '', assignedDriverId: '', status: 'active' }); setEditing(null); setShowAdd(true) }
  function openEdit(v: Vehicle) { setForm({ name: v.name, type: v.type, plate: v.plate, year: v.year, make: v.make, model: v.model, mileage: v.mileage, assignedDriverId: v.assignedDriverId ?? '', status: v.status }); setEditing(v); setShowAdd(true) }

  async function handleSave() {
    if (!form.name || !form.plate) return
    const updated = editing
      ? vehicles.map(v => v.id === editing.id ? { ...v, ...form, assignedDriverId: form.assignedDriverId || null } : v)
      : [...vehicles, { id: uid(), ...form, assignedDriverId: form.assignedDriverId || null, addedAt: new Date().toISOString() }]
    await persist(updated)
    setShowAdd(false)
  }

  async function remove(id: string) {
    if (!confirm('Remove this vehicle?')) return
    await persist(vehicles.filter(v => v.id !== id))
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-1">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} in fleet</p>
        </div>
        <button onClick={openAdd} className={btnPrimary}>+ Add Vehicle</button>
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
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => {
                const driver = drivers.find(u => u.id === v.assignedDriverId)
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
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(v)} className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3">Edit</button>
                      <button onClick={() => remove(v.id)} className="text-red-400 hover:text-red-600 font-medium text-xs">Remove</button>
                    </td>
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
              {drivers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 mt-2">
            <button onClick={handleSave} disabled={saving} className={`${btnPrimary} flex items-center gap-2`}>{saving && <Spinner />} Save Vehicle</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Drivers ───────────────────────────────────────────────────────────

function DriversView({ data, token, onMembersUpdate }: { data: FleetData; token: string; onMembersUpdate: (m: User[]) => void }) {
  const { fleet, members, vehicles } = data
  const drivers = members.filter(u => u.role === 'driver')
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  function copyCode() {
    navigator.clipboard.writeText(fleet.inviteCode).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function remove(memberId: string) {
    if (!confirm("Remove this driver from the fleet? Their account will be deleted.")) return
    setRemoving(memberId)
    try {
      await fleetApi.removeMember(token, fleet.id, memberId)
      onMembersUpdate(members.filter(u => u.id !== memberId))
    } catch (err: any) { alert(err.message) }
    finally { setRemoving(null) }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Drivers</h1>
        <p className="text-gray-500 text-sm mt-1">{drivers.length} driver{drivers.length !== 1 ? 's' : ''} in your fleet</p>
      </div>

      <div className="bg-blue-950 rounded-lg p-5 mb-6 flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">Fleet Invite Code</p>
          <p className="font-display text-3xl font-bold text-white tracking-[0.2em]">{fleet.inviteCode}</p>
          <p className="text-blue-400 text-xs mt-1">Share this code with drivers so they can sign up and join your fleet</p>
        </div>
        <button onClick={copyCode} className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-500 transition-colors">
          {copied ? '✓ Copied' : 'Copy Code'}
        </button>
      </div>

      {drivers.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-gray-500 font-medium">No drivers yet. Share the invite code above so drivers can sign up.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Assigned Vehicles</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map(d => {
                const assigned = vehicles.filter(v => v.assignedDriverId === d.id)
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">@{d.username}</p>
                      <p className="text-xs text-gray-500">{d.email}</p>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {assigned.length === 0 ? <span className="text-gray-400 italic text-xs">None assigned</span> :
                        assigned.map(v => <span key={v.id} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded mr-1">{v.name}</span>)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(d.id)} disabled={removing === d.id} className="text-red-400 hover:text-red-600 font-medium text-xs">
                        {removing === d.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Admin: Checklist Templates ───────────────────────────────────────────────

function TemplatesView({ data, token, onUpdate }: { data: FleetData; token: string; onUpdate: (t: ChecklistTemplate[]) => void }) {
  const { templates, fleet } = data
  const [selectedType, setSelectedType] = useState<VehicleType>('truck')
  const [showAddItem, setShowAddItem] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState({ label: '', type: 'passfail' as ChecklistItemType, required: true, placeholder: '' })

  const template = templates.find(t => t.vehicleType === selectedType) ?? { vehicleType: selectedType, items: [] }

  async function persistTemplates(updated: ChecklistTemplate[]) {
    setSaving(true)
    try { await fleetApi.saveTemplates(token, fleet.id, updated); onUpdate(updated) }
    catch { alert('Failed to save. Try again.') }
    finally { setSaving(false) }
  }

  function updateTemplate(items: ChecklistItem[]) {
    const updated = templates.find(t => t.vehicleType === selectedType)
      ? templates.map(t => t.vehicleType === selectedType ? { ...t, items } : t)
      : [...templates, { vehicleType: selectedType, items }]
    persistTemplates(updated)
  }

  function addItem() {
    if (!newItem.label) return
    updateTemplate([...template.items, { id: uid(), ...newItem }])
    setNewItem({ label: '', type: 'passfail', required: true, placeholder: '' }); setShowAddItem(false)
  }

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
                <button onClick={() => updateTemplate(template.items.filter(i2 => i2.id !== item.id))} disabled={saving} className="text-red-400 hover:text-red-600 text-xs font-medium ml-2">Remove</button>
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
            <Field label="Placeholder (optional)"><input className={inputCls} value={newItem.placeholder} onChange={e => setNewItem(p => ({ ...p, placeholder: e.target.value }))} /></Field>
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

function SubmissionsView({ data }: { data: FleetData }) {
  const { submissions, vehicles, members, templates } = data
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
              {submissions.slice().reverse().map(s => {
                const v = vehicles.find(v => v.id === s.vehicleId)
                const d = members.find(u => u.id === s.driverId)
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-semibold text-gray-900">{v?.name ?? 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">@{d?.username ?? 'Unknown'}</td>
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
            <div className="space-y-0 mb-4">
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

function MaintenanceAdminView({ data, token, onUpdate }: { data: FleetData; token: string; onUpdate: (m: MaintenanceRequest[]) => void }) {
  const { maintenance, vehicles, members, fleet } = data
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<MaintenanceStatus>('open')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | MaintenanceStatus>('all')

  function openDetail(r: MaintenanceRequest) { setSelected(r); setNotes(r.adminNotes); setStatus(r.status) }

  async function saveDetail() {
    if (!selected) return
    setSaving(true)
    const updated = maintenance.map(r => r.id === selected.id ? { ...r, status, adminNotes: notes } : r)
    try { await fleetApi.saveMaintenance(token, fleet.id, updated); onUpdate(updated); setSelected(null) }
    catch { alert('Failed to save.') }
    finally { setSaving(false) }
  }

  const filtered = filter === 'all' ? maintenance.slice().reverse() : maintenance.filter(r => r.status === filter).slice().reverse()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Maintenance Requests</h1>
        <p className="text-gray-500 text-sm mt-1">{maintenance.filter(r => r.status !== 'resolved').length} open</p>
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
            const d = members.find(u => u.id === r.driverId)
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
                  <p className="text-xs text-gray-400 mt-1">@{d?.username ?? 'Unknown'} · {new Date(r.date).toLocaleDateString()}</p>
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
            <button onClick={saveDetail} disabled={saving} className={`${btnPrimary} flex items-center gap-2`}>{saving && <Spinner />} Save</button>
            <button onClick={() => setSelected(null)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Admin: Settings ──────────────────────────────────────────────────────────

function AdminSettingsView({ currentUser, token, data, onUserUpdate, onFleetUpdate, onMembersUpdate }:
  { currentUser: User; token: string; data: FleetData; onUserUpdate: (u: User) => void; onFleetUpdate: (f: Fleet) => void; onMembersUpdate: (m: User[]) => void }) {
  const { fleet, members } = data
  const admins = members.filter(u => u.role === 'admin')

  const [myForm, setMyForm] = useState({ name: currentUser.name, email: currentUser.email, password: '', confirm: '' })
  const [myMsg, setMyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [mySaving, setMySaving] = useState(false)

  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '' })
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [inviteCode, setInviteCode] = useState(fleet.inviteCode)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  async function saveCredentials(e: React.FormEvent) {
    e.preventDefault()
    setMyMsg(null)
    if (myForm.password && myForm.password !== myForm.confirm) { setMyMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    setMySaving(true)
    try {
      const body: any = {}
      if (myForm.name !== currentUser.name) body.name = myForm.name
      if (myForm.email !== currentUser.email) body.email = myForm.email
      if (myForm.password) body.password = myForm.password
      if (Object.keys(body).length === 0) { setMyMsg({ type: 'ok', text: 'Nothing to update.' }); setMySaving(false); return }
      const { user } = await meApi.update(token, body)
      onUserUpdate(user)
      setMyForm(p => ({ ...p, password: '', confirm: '' }))
      setMyMsg({ type: 'ok', text: 'Credentials updated.' })
    } catch (err: any) {
      setMyMsg({ type: 'err', text: err.message })
    } finally { setMySaving(false) }
  }

  async function addAdmin() {
    setAddError('')
    setAddSaving(true)
    try {
      const { user } = await fleetApi.addAdmin(token, fleet.id, addForm)
      onMembersUpdate([...members, user])
      setAddForm({ username: '', email: '', password: '' }); setShowAddAdmin(false)
    } catch (err: any) { setAddError(err.message) }
    finally { setAddSaving(false) }
  }

  async function removeAdmin(memberId: string) {
    if (!confirm("Remove this admin account?")) return
    try {
      await fleetApi.removeMember(token, fleet.id, memberId)
      onMembersUpdate(members.filter(u => u.id !== memberId))
    } catch (err: any) { alert(err.message) }
  }

  async function regenInvite() {
    if (!confirm("Generate a new invite code? The old code will stop working.")) return
    setRegenLoading(true)
    try {
      const { inviteCode: newCode } = await fleetApi.regenerateInvite(token, fleet.id)
      setInviteCode(newCode)
      onFleetUpdate({ ...fleet, inviteCode: newCode })
    } catch (err: any) { alert(err.message) }
    finally { setRegenLoading(false) }
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteCode).catch(() => {})
    setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Credentials, admins, and fleet invite code</p>
      </div>

      {/* Invite code */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
        <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide mb-1">Fleet Invite Code</h2>
        <p className="text-xs text-gray-500 mb-4">Drivers use this code when they sign up to join your fleet</p>
        <div className="flex items-center gap-3">
          <span className="font-display text-3xl font-bold text-gray-900 tracking-[0.2em]">{inviteCode}</span>
          <button onClick={copyInvite} className={btnSecondary}>{copiedInvite ? '✓ Copied' : 'Copy'}</button>
          <button onClick={regenInvite} disabled={regenLoading} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            {regenLoading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* My credentials */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide">My Credentials</h2>
        </div>
        <form onSubmit={saveCredentials} className="px-6 py-5">
          {myMsg && <div className={`mb-4 text-sm rounded px-3 py-2 border ${myMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{myMsg.text}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display Name"><input className={inputCls} value={myForm.name} onChange={e => setMyForm(p => ({ ...p, name: e.target.value }))} /></Field>
            <Field label="Email"><input className={inputCls} type="email" value={myForm.email} onChange={e => setMyForm(p => ({ ...p, email: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="New Password"><input className={inputCls} type="password" value={myForm.password} onChange={e => setMyForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep current" /></Field>
            <Field label="Confirm Password"><input className={inputCls} type="password" value={myForm.confirm} onChange={e => setMyForm(p => ({ ...p, confirm: e.target.value }))} /></Field>
          </div>
          <button type="submit" disabled={mySaving} className={`${btnPrimary} flex items-center gap-2`}>{mySaving && <Spinner />} Save Changes</button>
        </form>
      </div>

      {/* Admin accounts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900 uppercase tracking-wide">Admin Accounts</h2>
            <p className="text-xs text-gray-500 mt-0.5">{admins.length} admin{admins.length !== 1 ? 's' : ''} — all have full access</p>
          </div>
          <button onClick={() => { setShowAddAdmin(true); setAddError('') }} className={btnPrimary}>+ Add Admin</button>
        </div>
        <div className="divide-y divide-gray-50">
          {admins.map(a => (
            <div key={a.id} className="flex items-center gap-4 px-6 py-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{a.username.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  @{a.username}
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

      {showAddAdmin && (
        <Modal title="Add Admin Account" onClose={() => setShowAddAdmin(false)}>
          {addError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-3">{addError}</div>}
          <Field label="Username"><input className={inputCls} value={addForm.username} onChange={e => setAddForm(p => ({ ...p, username: e.target.value }))} placeholder="janesmith" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></Field>
          <Field label="Password"><input className={inputCls} type="text" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder="Set a password" /></Field>
          <p className="text-xs text-gray-400 mb-4">Share their credentials so they can sign in. They'll have full admin access.</p>
          <div className="flex gap-3">
            <button onClick={addAdmin} disabled={addSaving} className={`${btnPrimary} flex items-center gap-2`}>{addSaving && <Spinner />} Create Admin</button>
            <button onClick={() => setShowAddAdmin(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Driver: My Vehicles ───────────────────────────────────────────────────────

function MyVehiclesView({ user, data, setPage }: { user: User; data: FleetData; setPage: (p: Page) => void }) {
  const myVehicles = data.vehicles.filter(v => v.assignedDriverId === user.id)
  const openMx = data.maintenance.filter(m => myVehicles.some(v => v.id === m.vehicleId) && m.status !== 'resolved')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">My Vehicles</h1>
        <p className="text-gray-500 text-sm mt-1">{myVehicles.length} assigned to you</p>
      </div>
      {myVehicles.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🚛</p>
          <p className="text-gray-500 font-medium">No vehicles assigned yet. Ask your fleet admin to assign vehicles to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myVehicles.map(v => {
            const vMx = openMx.filter(m => m.vehicleId === v.id).length
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
                {vMx > 0 && <div className="mt-3 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs text-amber-700 font-medium">{vMx} open maintenance request{vMx > 1 ? 's' : ''}</div>}
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

function InspectionView({ user, data, token, onSubmissionAdded }: { user: User; data: FleetData; token: string; onSubmissionAdded: (s: Submission[]) => void }) {
  const myVehicles = data.vehicles.filter(v => v.assignedDriverId === user.id)
  const { templates, fleet } = data
  const [vehicleId, setVehicleId] = useState(myVehicles[0]?.id ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [odometer, setOdometer] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const vehicle = myVehicles.find(v => v.id === vehicleId)
  const template = templates.find(t => t.vehicleType === vehicle?.type) ?? DEFAULT_TEMPLATES.find(t => t.vehicleType === vehicle?.type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle || !template) return
    setSaving(true)
    const sub: Submission = {
      id: uid(), vehicleId: vehicle.id, driverId: user.id,
      date: new Date().toISOString(),
      items: template.items.map(i => ({ itemId: i.id, value: answers[i.id] ?? '' })),
      notes, odometer,
    }
    const updated = [...data.submissions, sub]
    try {
      await fleetApi.saveSubmissions(token, fleet.id, updated)
      onSubmissionAdded(updated)
      setSubmitted(true)
    } catch { alert('Failed to submit. Try again.') }
    finally { setSaving(false) }
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

  if (myVehicles.length === 0) return (
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
              <select className={inputCls} value={vehicleId} onChange={e => { setVehicleId(e.target.value); setAnswers({}) }}>
                {myVehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
              </select>
            </Field>
            <Field label="Odometer (mi)">
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
                    <p className="text-sm font-medium text-gray-900 flex-1">
                      {item.label}{item.required && <span className="text-red-400 ml-1">*</span>}
                    </p>
                    <div className="shrink-0">
                      {(item.type === 'passfail' || item.type === 'yesno') && (
                        <div className="flex gap-1">
                          {(item.type === 'passfail' ? ['Pass', 'Fail'] : ['Yes', 'No']).map(opt => (
                            <button key={opt} type="button" onClick={() => setAnswers(p => ({ ...p, [item.id]: opt }))}
                              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${answers[item.id] === opt
                                ? opt === 'Pass' || opt === 'Yes' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {item.type === 'number' && <input type="number" className={`${inputCls} w-28`} value={answers[item.id] ?? ''} onChange={e => setAnswers(p => ({ ...p, [item.id]: e.target.value }))} placeholder={item.placeholder} />}
                      {item.type === 'text' && <input type="text" className={`${inputCls} w-48`} value={answers[item.id] ?? ''} onChange={e => setAnswers(p => ({ ...p, [item.id]: e.target.value }))} placeholder={item.placeholder} />}
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

        <button type="submit" disabled={saving} className={`${btnPrimary} py-3 w-full text-base flex items-center justify-center gap-2`}>
          {saving && <Spinner />} Submit Inspection Report
        </button>
      </form>
    </div>
  )
}

// ─── Driver: My History ────────────────────────────────────────────────────────

function MyHistoryView({ user, data }: { user: User; data: FleetData }) {
  const { submissions, vehicles, templates } = data
  const mine = submissions.filter(s => s.driverId === user.id).slice().reverse()
  const [selected, setSelected] = useState<Submission | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">My Reports</h1>
        <p className="text-gray-500 text-sm mt-1">{mine.length} inspection{mine.length !== 1 ? 's' : ''} submitted</p>
      </div>
      {mine.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No inspection reports yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map(s => {
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
        const tmpl = templates.find(t => t.vehicleType === v?.type) ?? DEFAULT_TEMPLATES.find(t => t.vehicleType === v?.type)
        return (
          <Modal title={`Inspection — ${v?.name ?? 'Vehicle'}`} onClose={() => setSelected(null)}>
            <p className="text-xs text-gray-500 mb-4">{new Date(selected.date).toLocaleString()} · Odometer: {selected.odometer || '—'}</p>
            <div className="mb-4">
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

function MyMaintenanceView({ user, data, token, onUpdate }: { user: User; data: FleetData; token: string; onUpdate: (m: MaintenanceRequest[]) => void }) {
  const myVehicles = data.vehicles.filter(v => v.assignedDriverId === user.id)
  const myRequests = data.maintenance.filter(m => m.driverId === user.id).slice().reverse()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ vehicleId: myVehicles[0]?.id ?? '', description: '', priority: 'medium' as MaintenancePriority })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.vehicleId || !form.description) return
    setSaving(true)
    const req: MaintenanceRequest = { id: uid(), vehicleId: form.vehicleId, driverId: user.id, date: new Date().toISOString(), description: form.description, status: 'open', priority: form.priority, adminNotes: '' }
    const updated = [...data.maintenance, req]
    try {
      await fleetApi.saveMaintenance(token, data.fleet.id, updated)
      onUpdate(updated)
      setForm({ vehicleId: myVehicles[0]?.id ?? '', description: '', priority: 'medium' }); setShowAdd(false)
    } catch { alert('Failed to submit. Try again.') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900 uppercase tracking-wide">Maintenance</h1>
          <p className="text-gray-500 text-sm mt-1">Report issues with your vehicles</p>
        </div>
        <button onClick={() => setShowAdd(true)} disabled={myVehicles.length === 0} className={btnPrimary}>+ Report Issue</button>
      </div>
      {myRequests.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-gray-500 font-medium">No maintenance requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myRequests.map(r => {
            const v = data.vehicles.find(v => v.id === r.vehicleId)
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
              {myVehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
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
            <button onClick={handleSubmit} disabled={saving} className={`${btnPrimary} flex items-center gap-2`}>{saving && <Spinner />} Submit Request</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login')
  const [token, setToken] = useState(LS.token)
  const [currentUser, setCurrentUser] = useState<User | null>(LS.user)
  const [fleetData, setFleetData] = useState<FleetData | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState<Page>(() => LS.user?.role === 'admin' ? 'dashboard' : 'my-vehicles')

  const loadFleetData = useCallback(async (tok: string, user: User) => {
    setLoadingData(true); setLoadError('')
    try {
      const [fleetInfo, vehicles, rawTemplates, submissions, maintenance] = await Promise.all([
        fleetApi.get(tok, user.fleetId),
        fleetApi.getVehicles(tok, user.fleetId),
        fleetApi.getTemplates(tok, user.fleetId),
        fleetApi.getSubmissions(tok, user.fleetId),
        fleetApi.getMaintenance(tok, user.fleetId),
      ])
      // Merge stored templates with any new vehicle types in DEFAULT_TEMPLATES
      const stored: ChecklistTemplate[] = Array.isArray(rawTemplates) && rawTemplates.length > 0 ? rawTemplates : DEFAULT_TEMPLATES
      const storedTypes = new Set(stored.map((t: ChecklistTemplate) => t.vehicleType))
      const merged = [...stored, ...DEFAULT_TEMPLATES.filter(t => !storedTypes.has(t.vehicleType))]

      setFleetData({
        fleet: fleetInfo.fleet,
        members: fleetInfo.members,
        vehicles: Array.isArray(vehicles) ? vehicles : [],
        templates: merged,
        submissions: Array.isArray(submissions) ? submissions : [],
        maintenance: Array.isArray(maintenance) ? maintenance : [],
      })
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load fleet data.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  // On mount, if we have a stored session, load fleet data
  useEffect(() => {
    if (token && currentUser) {
      loadFleetData(token, currentUser)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAuth(newToken: string, user: User) {
    setToken(newToken); setCurrentUser(user)
    LS.token = newToken; LS.user = user
    setPage(user.role === 'admin' ? 'dashboard' : 'my-vehicles')
    loadFleetData(newToken, user)
  }

  async function handleLogout() {
    if (token) auth.logout(token).catch(() => {})
    setToken(''); setCurrentUser(null); setFleetData(null)
    LS.token = ''; LS.user = null
  }

  function handleUserUpdate(updated: User) {
    setCurrentUser(updated); LS.user = updated
  }

  if (!token || !currentUser) {
    return authScreen === 'login'
      ? <LoginScreen onLogin={handleAuth} onGoSignup={() => setAuthScreen('signup')} />
      : <SignupScreen onSignup={handleAuth} onGoLogin={() => setAuthScreen('login')} />
  }

  if (loadingData || !fleetData) {
    return loadError
      ? (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-red-400 text-sm">{loadError}</p>
          <button onClick={() => loadFleetData(token, currentUser)} className={btnPrimary}>Retry</button>
          <button onClick={handleLogout} className="text-gray-500 text-xs hover:text-gray-400">Sign out</button>
        </div>
      )
      : <LoadingScreen message="Loading your fleet data…" />
  }

  function renderPage() {
    if (!currentUser || !fleetData) return null
    const props = { data: fleetData, token }

    if (currentUser.role === 'admin') {
      const adminProps = {
        ...props,
        onVehiclesUpdate: (v: Vehicle[]) => setFleetData(d => d ? { ...d, vehicles: v } : d),
        onTemplatesUpdate: (t: ChecklistTemplate[]) => setFleetData(d => d ? { ...d, templates: t } : d),
        onMembersUpdate: (m: User[]) => setFleetData(d => d ? { ...d, members: m } : d),
        onFleetUpdate: (f: Fleet) => setFleetData(d => d ? { ...d, fleet: f } : d),
        onMaintenanceUpdate: (m: MaintenanceRequest[]) => setFleetData(d => d ? { ...d, maintenance: m } : d),
      }
      if (page === 'dashboard') return <AdminDashboard data={fleetData} setPage={setPage} />
      if (page === 'vehicles') return <VehiclesView data={fleetData} token={token} onUpdate={adminProps.onVehiclesUpdate} />
      if (page === 'drivers') return <DriversView data={fleetData} token={token} onMembersUpdate={adminProps.onMembersUpdate} />
      if (page === 'templates') return <TemplatesView data={fleetData} token={token} onUpdate={adminProps.onTemplatesUpdate} />
      if (page === 'submissions') return <SubmissionsView data={fleetData} />
      if (page === 'maintenance') return <MaintenanceAdminView data={fleetData} token={token} onUpdate={adminProps.onMaintenanceUpdate} />
      if (page === 'settings') return <AdminSettingsView currentUser={currentUser} token={token} data={fleetData} onUserUpdate={handleUserUpdate} onFleetUpdate={adminProps.onFleetUpdate} onMembersUpdate={adminProps.onMembersUpdate} />
    } else {
      if (page === 'my-vehicles') return <MyVehiclesView user={currentUser} data={fleetData} setPage={setPage} />
      if (page === 'inspection') return <InspectionView user={currentUser} data={fleetData} token={token} onSubmissionAdded={(s) => setFleetData(d => d ? { ...d, submissions: s } : d)} />
      if (page === 'my-history') return <MyHistoryView user={currentUser} data={fleetData} />
      if (page === 'my-maintenance') return <MyMaintenanceView user={currentUser} data={fleetData} token={token} onUpdate={(m) => setFleetData(d => d ? { ...d, maintenance: m } : d)} />
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
