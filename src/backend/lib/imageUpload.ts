/**
 * Image uploads. The file type is decided by its magic bytes, never by the
 * client-supplied name or MIME type. Where the file is kept (disk or an
 * S3-compatible bucket) is decided in lib/storage.
 */
import { ServiceError } from "@/backend/types";
import { putImage } from "@/backend/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

function sniff(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function saveImage(file: unknown) {
  if (!(file instanceof File)) throw new ServiceError("VALIDATION", "Choose an image to upload", 400);
  if (file.size > MAX_BYTES) throw new ServiceError("VALIDATION", "Image too large (max 5 MB)", 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new ServiceError("VALIDATION", "Upload a JPG, PNG or WebP image", 400);
  const { url } = await putImage(buf, ext);
  return { url, size: file.size };
}
