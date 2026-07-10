import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM Postgres; keep it external so Next doesn't bundle it
  // (the /api/line-data route reads it at runtime in the Node server).
  serverExternalPackages: ['@electric-sql/pglite'],
  // Pin the workspace root so stray lockfiles elsewhere don't confuse Next.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
