/** @type {import('next').NextConfig} */
const nextConfig = {
  // `build/` instead of `.next/` so the npm tarball has no dot-folder to fight with.
  distDir: 'build',
  // Off on purpose: StrictMode double-mounts effects in dev, which would start two
  // SQLite scans every time a project page opens.
  reactStrictMode: false,
  // Local tool; no telemetry headers, no image CDN.
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ['agent-spend-cursor-data-access'],
}

export default nextConfig
