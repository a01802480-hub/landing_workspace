'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Workspace() {
  const router = useRouter();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    console.log('Workspace page loaded');
    
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    console.log('Auth status:', isAuthenticated);
    
    if (!isAuthenticated || isAuthenticated !== 'true') {
      console.log('Not authenticated! Redirecting to signin...');
      setStatus('Redirecting to sign in...');
      router.replace('/signin');
      return;
    }

    console.log('Authenticated! Redirecting to BioStream...');
    setStatus('Connecting to BioStream workspace...');
    
    // Force immediate redirect
    const redirectTimer = setTimeout(() => {
      console.log('Executing redirect to http://localhost:3001');
      window.location.replace('http://localhost:3001');
    }, 500);

    return () => clearTimeout(redirectTimer);
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
            Authenticated: {typeof window !== 'undefined' && localStorage.getItem('isAuthenticated') === 'true' ? 'Yes ✓' : 'No ✗'}
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