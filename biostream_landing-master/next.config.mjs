/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages compatibility
  output: 'export',
  
  // Disable image optimization (not supported on Cloudflare Pages)
  images: {
    unoptimized: true,
  },
  
  // Environment variables for API URL
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
};

export default nextConfig;
