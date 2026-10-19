/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@evoc/types', '@evoc/database']
};

export default nextConfig;
