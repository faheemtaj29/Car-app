/**
 * Where uploaded photos live.
 *
 *   STORAGE_DRIVER=local (default)  files in UPLOAD_DIR (default ./public/uploads),
 *                                    served by the /uploads route. Fine for one
 *                                    server with a persistent disk or volume.
 *   STORAGE_DRIVER=s3                any S3-compatible bucket (AWS S3, Cloudflare
 *                                    R2, MinIO, DigitalOcean Spaces, Backblaze B2).
 *                                    Needed when the host's disk is temporary or
 *                                    you run more than one server.
 *
 * S3 settings: S3_BUCKET, S3_REGION (use "auto" for R2), S3_ENDPOINT (R2/MinIO),
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL (the public address the
 * bucket's files are served from, e.g. https://cdn.example.pk), and
 * S3_FORCE_PATH_STYLE=1 for MinIO.
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ServiceError } from "@/backend/types";
import { bucketBase } from "@/lib/hostedImage";

// The turbopackIgnore marker stops the build from treating this as a reason to bundle the whole project folder.
export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads"));

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const contentTypeFor = (ext: string) => TYPES[ext.toLowerCase()];

export function storageDriver() {
  return (process.env.STORAGE_DRIVER || "local").toLowerCase() === "s3" ? "s3" : "local";
}

/** Stores one image and returns the URL to save on the listing. */
export async function putImage(buf: Buffer, ext: "jpg" | "png" | "webp") {
  const now = new Date();
  const rel = path.posix.join("images", String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"));
  const name = `${randomUUID()}.${ext}`;

  if (storageDriver() === "s3") {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !bucketBase()) {
      throw new ServiceError("INTERNAL", "Photo storage is not configured", 500);
    }
    const client = new S3Client({
      region: S3_REGION || "auto",
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });
    const key = `${rel}/${name}`;
    await client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buf, ContentType: TYPES[ext], CacheControl: "public, max-age=31536000, immutable" }));
    return { url: `${bucketBase()}/${key}` };
  }

  const dir = path.join(uploadDir(), rel);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${rel}/${name}` };
}
