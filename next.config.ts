import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// MapLibre loads style JSON, glyphs, sprites and tiles with fetch(), so every
// tile host must be allowed in connect-src as well as img-src. Supabase needs
// https for the API and wss for realtime.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tiles.openfreemap.org https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org" +
    (isDev ? " ws://localhost:*" : ""),
  "worker-src 'self' blob:",
  "media-src 'self' https:",
  "manifest-src 'self'",
  "frame-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ihmfpkcbeawfkuswheci.supabase.co",
        pathname: "/storage/v1/object/public/post-images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
