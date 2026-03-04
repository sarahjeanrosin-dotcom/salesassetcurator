import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'bullmq', 'ioredis'],
};

export default nextConfig;
