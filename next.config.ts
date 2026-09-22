import type { NextConfig } from 'next';

const githubBase = process.env.GITHUB_PAGES === '1' ? '' : '';
const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: process.env.GITHUB_PAGES === '1' ? '/clear-day-journal/' : undefined,
  trailingSlash: true,
};

export default nextConfig;
