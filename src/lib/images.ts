import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getAdminClient } from "@/lib/supabase/admin";
import { UPLOAD_MAX_BYTES } from "@/lib/validation/admin";

const TMP = "uploads-tmp";
const FORMATS = new Set(["jpeg", "png", "webp"]);
const FULL_WIDTH = 1920;
const THUMB_WIDTH = 640;
const STALE_MS = 60 * 60 * 1000;

export type StoredImage = { storage_path: string; thumb_path: string | null; width: number; height: number };

export class ImageError extends Error {}

// Each admin uploads into their own folder, so one person can never process another's file.
function tmpPathFor(userId: string): string {
  return `${userId}/${randomUUID()}`;
}

export async function signedUpload(userId: string): Promise<{ path: string; url: string } | null> {
  const storage = getAdminClient().storage.from(TMP);
  await sweepStale(userId);
  const path = tmpPathFor(userId);
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path, url: data.signedUrl };
}

async function sweepStale(userId: string): Promise<void> {
  const storage = getAdminClient().storage.from(TMP);
  const { data } = await storage.list(userId, { limit: 100 });
  const old = (data ?? []).filter((f) => f.created_at && Date.now() - Date.parse(f.created_at) > STALE_MS);
  if (old.length) await storage.remove(old.map((f) => `${userId}/${f.name}`));
}

// Re-encodes as WebP: strips metadata, applies EXIF rotation and rejects anything sharp can't read.
export async function processUpload(
  tmpPath: string,
  bucket: "property-photos" | "blog-images",
  folder: string,
  withThumb: boolean,
): Promise<StoredImage> {
  const admin = getAdminClient();
  const tmp = admin.storage.from(TMP);
  try {
    const { data: blob, error } = await tmp.download(tmpPath);
    if (error || !blob) throw new ImageError("The upload could not be found. Please try again.");
    if (blob.size > UPLOAD_MAX_BYTES) throw new ImageError("Please choose an image under 15 MB.");
    const input = Buffer.from(await blob.arrayBuffer());

    const meta = await sharp(input, { limitInputPixels: 50_000_000 })
      .metadata()
      .catch(() => null);
    if (!meta?.format || !FORMATS.has(meta.format)) {
      throw new ImageError("Please choose a JPEG, PNG or WebP image.");
    }

    const base = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
    const full = await base
      .clone()
      .resize({ width: FULL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = withThumb
      ? await base.clone().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer()
      : null;

    const id = randomUUID();
    const storage_path = `${folder}/${id}.webp`;
    const thumb_path = thumb ? `${folder}/${id}-${THUMB_WIDTH}.webp` : null;
    const target = admin.storage.from(bucket);
    const files: [string, Buffer][] = [[storage_path, full.data]];
    if (thumb_path && thumb) files.push([thumb_path, thumb]);
    for (const [path, body] of files) {
      const { error: upErr } = await target.upload(path, body, { contentType: "image/webp" });
      if (upErr) throw new Error("image upload failed");
    }
    return { storage_path, thumb_path, width: full.info.width, height: full.info.height };
  } finally {
    await tmp.remove([tmpPath]);
  }
}

export async function removeImages(bucket: "property-photos" | "blog-images", paths: string[]): Promise<void> {
  if (paths.length) await getAdminClient().storage.from(bucket).remove(paths);
}
