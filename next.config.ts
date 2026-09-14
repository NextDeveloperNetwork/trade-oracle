import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
