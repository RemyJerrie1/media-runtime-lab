import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  transpilePackages: ['@media-lab/contracts'],
  devIndicators: false,
};
export default nextConfig;
