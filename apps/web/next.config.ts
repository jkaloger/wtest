import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `just check` owns typechecking (tests included). Building twice adds nothing.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
