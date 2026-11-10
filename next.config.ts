import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ihmfpkcbeawfkuswheci.supabase.co",
        pathname: "/storage/v1/object/public/post-images/**",
      },
    ],
  },
};

export default nextConfig;
