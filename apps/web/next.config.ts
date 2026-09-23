import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  transpilePackages: ['@media-lab/contracts'],
  devIndicators: false,
  outputFileTracingIncludes: {
    '/models/hamster-3.glb': ['../../packages/scene-renderer/assets/hamster-3/hamster.glb'],
  },
};
export default nextConfig;
