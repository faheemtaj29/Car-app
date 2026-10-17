/**
 * Production configuration check. Prints every problem, then exits with an
 * error so the hosting platform sees a failed start (and alerts or retries)
 * instead of a half-working server.
 */
export function checkProductionConfig() {
  const problems: string[] = [];
  const warnings: string[] = [];
  const secret = process.env.JWT_SECRET || "";
  if (!process.env.MONGODB_URI) problems.push("MONGODB_URI is not set");
  if (secret.length < 32) problems.push("JWT_SECRET must be at least 32 random characters");
  if (/change-me|dev-secret|test-secret|build-placeholder|password|secret123/i.test(secret)) problems.push("JWT_SECRET looks like an example value: generate a new one (openssl rand -hex 32)");
  if (!/^https:\/\//.test(process.env.SITE_URL || "")) warnings.push("SITE_URL should be your https address (used in certificates, QR codes and the sitemap)");
  if ((process.env.STORAGE_DRIVER || "local") === "local" && !process.env.UPLOAD_DIR) warnings.push("Photos are saved inside the app folder; set UPLOAD_DIR to a persistent volume, or STORAGE_DRIVER=s3");
  if ((process.env.NADRA_PROVIDER || "off") === "mock") warnings.push("NADRA_PROVIDER=mock is ignored in production");
  for (const w of warnings) console.warn(`[config] ${w}`);
  if (problems.length) {
    for (const p of problems) console.error(`[config] ERROR: ${p}`);
    console.error("[config] Refusing to start with an unsafe configuration.");
    process.exit(1);
  }
}
