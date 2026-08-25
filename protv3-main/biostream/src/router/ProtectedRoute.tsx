/**
 * Auth guard component.
 * Redirects unauthenticated users to the sign-in page.
 *
 * In development, the SPA auto-loads with mock data when no token is present
 * so you can work without the backend. The backend is still required for
 * real auth, workspace CRUD, and calendar persistence.
 */
import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { authService } from '../services/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const loadWorkspaces = useWorkspaceStore(s => s.loadWorkspaces)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const check = async () => {
      const token = authService.getAccessToken()

      if (!token) {
        // No token at all
        if (import.meta.env.PROD) {
          // Production: hard redirect to sign-in — you MUST have a valid token
          window.location.href = 'http://localhost:3000/signin'
          return
        }
        // Development: proceed with mock data (no redirect, but auth state is empty)
        // The SPA will work with mock workspaces; backend-dependent features
        // (workspace CRUD, calendar, API proxy) will fail gracefully until a
        // real token is provided.
        setAuthChecked(true)
        return
      }

      // Token exists — validate it with the backend
      const user = await authService.getCurrentUser()
      if (!user) {
        // Token is invalid / expired / backend unreachable
        if (import.meta.env.PROD) {
          // Production: redirect — bad token means you need to sign in again
          authService.clearTokens()
          window.location.href = 'http://localhost:3000/signin'
          return
        }
        // Development: token failed validation, but let the user through.
        // The token may be from a previous session or an old mock — the SPA
        // will render with whatever workspaces it can fetch.
        console.warn(
          'Auth token could not be validated (backend may be offline). ' +
          'Proceeding in development mode with limited functionality.'
        )
      }

      setAuthChecked(true)
    }

    check()
  }, [])

  useEffect(() => {
    // Load workspaces when auth check completes
    if (authChecked) {
      loadWorkspaces()
    }
  }, [authChecked, loadWorkspaces])

  // Show a loading state while validating the token
  if (!authChecked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent" />
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
            Verifying session…
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
