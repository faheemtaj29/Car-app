import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font files from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
