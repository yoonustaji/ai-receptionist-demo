import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker or any VPS. Vercel ignores this.
  output: "standalone",
};

export default nextConfig;
