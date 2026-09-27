import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@splitline/core", "@splitline/edge", "@splitline/store"],
};

export default nextConfig;
