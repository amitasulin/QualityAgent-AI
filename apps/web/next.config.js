/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const rewrites = [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];

    // Optional same-origin proxy for local development against a remote API
    // (avoids CORS issues). Enable with API_PROXY_TARGET in .env.development.local.
    if (process.env.API_PROXY_TARGET) {
      rewrites.push({
        source: '/api/proxy/:path*',
        destination: `${process.env.API_PROXY_TARGET}/:path*`,
      });
    }

    return rewrites;
  },
};

module.exports = nextConfig;
