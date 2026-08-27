import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep dependency and trace discovery inside this standalone frontend project.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
