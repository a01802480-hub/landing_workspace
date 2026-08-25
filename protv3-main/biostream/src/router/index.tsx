/**
 * React Router v6 configuration for BioStream.
 * All workspace state flows through Zustand stores —
 * the router only provides URL structure.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { BenchlingLayout } from '../layouts/BenchlingLayout'
import { ProtectedRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/workspace" replace />,
  },
  {
    path: '/workspace',
    element: (
      <ProtectedRoute>
        <BenchlingLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '*',
        element: <BenchlingLayout />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/workspace" replace />,
  },
])
