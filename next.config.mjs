/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for Cloudflare Pages (the documented deploy path).
  // `next dev` ignores this; `next build` emits `out/`.
  output: "export",
  // 3dmol ships CommonJS/UMD internals — transpile it so the app-router
  // build can consume it. seqviz and @xyflow/react are ESM and need none.
  transpilePackages: ["3dmol"],
};

export default nextConfig;
