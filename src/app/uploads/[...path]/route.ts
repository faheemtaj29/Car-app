import { readFile } from "fs/promises";
import path from "path";
import { contentTypeFor, uploadDir } from "@/backend/lib/storage";

/**
 * Serves uploaded photos from disk. A production Next.js server only serves
 * files that were in /public when it started, so photos uploaded later need
 * this route. (Not used when STORAGE_DRIVER=s3.)
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  const file = parts[parts.length - 1] || "";
  const type = contentTypeFor(file.split(".").pop() || "");
  // Plain names only: no "..", no hidden files, only the image types we store.
  if (!type || !parts.every((p) => /^[\w][\w.-]*$/.test(p) && !p.includes(".."))) return new Response("Not found", { status: 404 });
  const root = uploadDir();
  const full = path.resolve(root, ...parts);
  if (!full.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(full);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
