import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    serverActions: {
      // Receipt attachments are uploaded through a Server Action.
      bodySizeLimit: "6mb",
    },
  },
}

export default nextConfig
