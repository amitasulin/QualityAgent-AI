/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Stop browsers from MIME-sniffing a response into a different content type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only allow the app to be framed by its own origin (protects against clickjacking).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Do not leak full URLs to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app needs none of these device APIs.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Force HTTPS for a year on deployed environments.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['localhost'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
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
