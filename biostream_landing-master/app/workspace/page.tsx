'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Workspace() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying authentication...');
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    console.log('Workspace page loaded');
    
    const validateAuth = async () => {
      // Check if we have a token
      const accessToken = localStorage.getItem('access_token');
      console.log('Access token:', accessToken ? 'Present' : 'Missing');
      
      if (!accessToken) {
        console.log('No access token! Redirecting to signin...');
        setStatus('Redirecting to sign in...');
        router.replace('/signin');
        return;
      }

      try {
        // Validate token with backend
        setStatus('Validating with server...');
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          console.log('Token validation failed! Redirecting to signin...');
          // Clear invalid tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('isAuthenticated');
          
          setStatus('Redirecting to sign in...');
          router.replace('/signin');
          return;
        }

        const user = await response.json();
        console.log('✓ Authentication validated!', user);
        setStatus('Connecting to BioStream workspace...');
        
        // Force immediate redirect
        const redirectTimer = setTimeout(() => {
          console.log('Executing redirect to http://localhost:3001');
          window.location.replace('http://localhost:3001');
        }, 500);

        return () => clearTimeout(redirectTimer);
      } catch (error) {
        console.error('Authentication validation error:', error);
        // Clear tokens on error
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        
        setStatus('Redirecting to sign in...');
        router.replace('/signin');
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Animated loading spinner */}
        <div className="relative mb-6">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-[#5B50D6] mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-[#5B50D6] rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-[#2D266F] mb-3">Loading Workspace</h2>
        <p className="text-gray-600 mb-2">{status}</p>
        
        {/* Debug info */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
          <p className="text-xs text-yellow-800 mb-2 font-semibold">Debug Information:</p>
          <p className="text-xs text-yellow-700 mb-1">Status: {status}</p>
          <p className="text-xs text-yellow-700 mb-1">
            Validating: {isValidating ? 'Yes...' : 'Complete'}
          </p>
          <p className="text-xs text-yellow-700">
            Target: http://localhost:3001
          </p>
        </div>
        
        {/* Manual redirect button */}
        <div className="mt-6 bg-white/80 backdrop-blur rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600 mb-3">If automatic redirect doesn't work:</p>
          <a 
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-[#5B50D6] text-white rounded-lg hover:bg-[#4a42b8] transition-all font-medium shadow-md hover:shadow-lg"
          >
            Open Workspace Manually →
          </a>
        </div>
        
        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-gray-500 hover:text-[#5B50D6] underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
