import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@splitline/core", "@splitline/edge", "@splitline/store"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
