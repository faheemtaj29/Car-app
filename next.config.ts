import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

/**
 * Browser security headers. The CSP deliberately limits only what is safe to
 * limit without per-request nonces: nobody can frame the site, forms post
 * only to us, no plugins, and the only third-party frames are the video
 * players used for walkaround videos.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "frame-src https://www.youtube-nocookie.com https://player.vimeo.com"].join("; "),
  },
  // Only over real HTTPS: telling a browser "HTTPS only" on plain http would lock people out.
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  // Belt and braces: never copy secrets, git history, uploads or docs into the standalone bundle.
  outputFileTracingExcludes: {
    "*": [".env*", ".git/**", "public/uploads/**", "uploads/**", "scripts/**", "ARCHITECTURE/**", "backups/**", "*.md", "Dockerfile", "docker-compose.yml", "Caddyfile", ".next/cache/**"],
  },
  // pdfkit reads its font files from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Photos never change once uploaded (each gets a unique name), so browsers and CDNs may keep them a year.
      // The service worker must be re-checked on every visit so updates reach phones.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/uploads/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // Back office and APIs must never be cached by a shared cache.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
