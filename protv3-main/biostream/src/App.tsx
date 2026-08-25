'use client'

import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { router } from './router'
import { authService } from './services/auth'
import { useWorkspaceStore } from './store/workspaceStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 min before refetch
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * BioStream — Benchling-style Bioinformatics Platform
 *
 * Architecture:
 * - React Router v6 for URL-based navigation
 * - Zustand stores for state management (no props drilling)
 * - @tanstack/react-query for server state + caching
 * - Four-panel Benchling-style layout
 */
function App() {
  const [authChecking, setAuthChecking] = useState(true)
  const loadWorkspaces = useWorkspaceStore(s => s.loadWorkspaces)

  useEffect(() => {
    const init = async () => {
      // Cross-origin token handoff from Next.js landing page (port 3000)
      const urlParams = new URLSearchParams(window.location.search)
      const tokenFromUrl = urlParams.get('token')

      if (tokenFromUrl) {
        localStorage.setItem('access_token', tokenFromUrl)
        window.history.replaceState({}, '', window.location.pathname)
      }

      const accessToken = localStorage.getItem('access_token')
      if (!accessToken && import.meta.env.PROD) {
        window.location.href = 'http://localhost:3000/signin'
        return
      }

      // Validate token
      if (accessToken) {
        const user = await authService.getCurrentUser()
        if (!user && import.meta.env.PROD) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = 'http://localhost:3000/signin'
          return
        }
      }

      // Load workspaces
      await loadWorkspaces()
      setAuthChecking(false)
    }

    init()
  }, [loadWorkspaces])

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-400 border-t-transparent" />
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
            Loading BioStream...
          </p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontSize: '12px',
            borderRadius: '8px',
            background: '#1e293b',
            color: '#f1f5f9',
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
