import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo — /Users/harness has an unrelated
  // stray package-lock.json that Next.js otherwise mis-detects as the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
