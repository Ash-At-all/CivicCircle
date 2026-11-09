import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopack: {
      rules: [
        {
          test: /\.css$/i,
          use: ['@tailwindcss/turbopack'],
        },
      ],
    },
  },
};

export default nextConfig;
