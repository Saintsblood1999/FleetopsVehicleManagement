import { projectId } from '../utils/supabase/info'

export const API = `https://${projectId}.supabase.co/functions/v1/make-server-b938ffa6`

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({ error: 'Server error' }))
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export const auth = {
  signup: (body: { username: string; email: string; password: string; fleetName?: string; inviteCode?: string }) =>
    call('POST', '/auth/signup', body),
  login: (email: string, password: string) =>
    call('POST', '/auth/login', { email, password }),
  logout: (token: string) =>
    call('DELETE', '/auth/logout', undefined, token),
}

export const me = {
  update: (token: string, body: { name?: string; email?: string; password?: string }) =>
    call('PUT', '/me', body, token),
}

export const fleet = {
  get: (token: string, fleetId: string) =>
    call('GET', `/fleet/${fleetId}`, undefined, token),
  addAdmin: (token: string, fleetId: string, body: { username: string; email: string; password: string }) =>
    call('POST', `/fleet/${fleetId}/admins`, body, token),
  removeMember: (token: string, fleetId: string, memberId: string) =>
    call('DELETE', `/fleet/${fleetId}/members/${memberId}`, undefined, token),
  regenerateInvite: (token: string, fleetId: string) =>
    call('POST', `/fleet/${fleetId}/regenerate-invite`, undefined, token),
  getVehicles: (token: string, fleetId: string) =>
    call('GET', `/fleet/${fleetId}/vehicles`, undefined, token),
  saveVehicles: (token: string, fleetId: string, data: unknown) =>
    call('PUT', `/fleet/${fleetId}/vehicles`, data, token),
  getTemplates: (token: string, fleetId: string) =>
    call('GET', `/fleet/${fleetId}/templates`, undefined, token),
  saveTemplates: (token: string, fleetId: string, data: unknown) =>
    call('PUT', `/fleet/${fleetId}/templates`, data, token),
  getSubmissions: (token: string, fleetId: string) =>
    call('GET', `/fleet/${fleetId}/submissions`, undefined, token),
  saveSubmissions: (token: string, fleetId: string, data: unknown) =>
    call('PUT', `/fleet/${fleetId}/submissions`, data, token),
  getMaintenance: (token: string, fleetId: string) =>
    call('GET', `/fleet/${fleetId}/maintenance`, undefined, token),
  saveMaintenance: (token: string, fleetId: string, data: unknown) =>
    call('PUT', `/fleet/${fleetId}/maintenance`, data, token),
}
