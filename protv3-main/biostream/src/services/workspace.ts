import { authService } from './auth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface WorkspaceFile {
  id: string
  name: string
  type: 'protein' | 'dna'
  sequence: string
  createdAt: string
}

export interface WorkspaceData {
  id: string
  name: string
  owner: string
  description: string
  sequenceCount: number
  files: WorkspaceFile[]
  createdAt: string
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  const token = authService.getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Try refresh on 401
  let res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    try {
      await authService.refreshAccessToken()
      const newToken = authService.getAccessToken()
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
        res = await fetch(url, { ...options, headers })
      }
    } catch {
      // refresh failed — let the 401 propagate
    }
  }
  return res
}

export async function fetchWorkspaces(): Promise<WorkspaceData[]> {
  const res = await authFetch(`${API_BASE}/workspaces`)
  if (!res.ok) {
    console.error('Failed to fetch workspaces:', res.status)
    return []
  }
  return res.json()
}

export async function createWorkspace(name: string, description = ''): Promise<WorkspaceData | null> {
  const res = await authFetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) {
    console.error('Failed to create workspace:', res.status)
    return null
  }
  return res.json()
}

export async function updateWorkspace(id: string, data: { name?: string; description?: string }): Promise<WorkspaceData | null> {
  const res = await authFetch(`${API_BASE}/workspaces/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) return null
  return res.json()
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/workspaces/${id}`, { method: 'DELETE' })
  return res.ok
}

export async function addFileToWorkspaceApi(
  workspaceId: string,
  file: { name: string; type: string; sequence: string }
): Promise<WorkspaceFile | null> {
  const res = await authFetch(`${API_BASE}/workspaces/${workspaceId}/files`, {
    method: 'POST',
    body: JSON.stringify(file),
  })
  if (!res.ok) return null
  return res.json()
}

export async function removeFileFromWorkspace(workspaceId: string, fileId: string): Promise<boolean> {
  const res = await authFetch(`${API_BASE}/workspaces/${workspaceId}/files/${fileId}`, { method: 'DELETE' })
  return res.ok
}
