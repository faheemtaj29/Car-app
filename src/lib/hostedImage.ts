/**
 * Which image URLs are ours? Used by the validators so a listing can only
 * point at a photo we stored (local /uploads or the configured bucket), never
 * at an arbitrary address. Server-side only: reads S3_PUBLIC_URL.
 */
const LOCAL = /^\/uploads\/[\w/.-]+$/;

export function bucketBase() {
  return (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function isHostedImage(url: string) {
  if (LOCAL.test(url)) return true;
  const base = bucketBase();
  return Boolean(base) && url.startsWith(`${base}/`) && /^https?:\/\/[^\s]+\.(jpg|png|webp)$/i.test(url);
}
