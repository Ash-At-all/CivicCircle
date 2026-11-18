import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Chat photos live in a private bucket and are served as short-lived signed
// URLs. The client also runs the shared processImage pipeline, so most
// uploads arrive already compressed as WebP.
export const AREA_PHOTO_BUCKET = "area-photos";
export const AREA_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const AREA_PHOTO_MAX_DIMENSION = 1600;
export const AREA_PHOTO_WEBP_QUALITY = 80;
export const AREA_PHOTO_URL_TTL_SECONDS = 60 * 60;

const ACCEPTED_MIME_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

export class AreaPhotoTooLargeError extends Error {}
export class AreaPhotoUnsupportedError extends Error {}

export function isAreaPhotoMime(mime: string) {
  return ACCEPTED_MIME_TYPES.has(mime.toLowerCase());
}

function isWebp(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    RIFF_SIGNATURE.every((byte, index) => bytes[index] === byte) &&
    WEBP_SIGNATURE.every((byte, index) => bytes[index + 8] === byte)
  );
}

/**
 * Accepts JPEG, PNG, or WebP and returns WebP bytes. Input that already came
 * out of the client pipeline is passed through untouched.
 */
export async function convertAreaPhotoToWebp(bytes: Uint8Array, mime: string) {
  const normalized = mime.toLowerCase();
  if (!ACCEPTED_MIME_TYPES.has(normalized)) {
    throw new AreaPhotoUnsupportedError("unsupported image type");
  }

  if (normalized === "image/webp" && isWebp(bytes)) {
    if (bytes.byteLength > AREA_PHOTO_MAX_BYTES) {
      throw new AreaPhotoTooLargeError("image too large");
    }
    return bytes;
  }

  try {
    const { default: sharp } = await import("sharp");
    const output = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({
        width: AREA_PHOTO_MAX_DIMENSION,
        height: AREA_PHOTO_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: AREA_PHOTO_WEBP_QUALITY })
      .toBuffer();

    if (output.byteLength > AREA_PHOTO_MAX_BYTES) {
      throw new AreaPhotoTooLargeError("image too large after compression");
    }
    return new Uint8Array(output);
  } catch (error) {
    if (error instanceof AreaPhotoTooLargeError) throw error;
    throw new AreaPhotoUnsupportedError("image could not be read");
  }
}

/**
 * Signs a batch of photo paths. Failures degrade to a missing URL instead of
 * failing the whole page, and the path itself never reaches the client.
 */
export async function signAreaPhotoUrls(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter((path) => Boolean(path)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  try {
    const { data, error } = await supabase.storage
      .from(AREA_PHOTO_BUCKET)
      .createSignedUrls(unique, AREA_PHOTO_URL_TTL_SECONDS);

    if (error) {
      console.error("Area photo signing failed:", error.message);
      return urls;
    }

    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  } catch (error) {
    console.error("Area photo signing failed:", error);
  }

  return urls;
}

export async function removeAreaPhoto(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage.from(AREA_PHOTO_BUCKET).remove([path]);
  if (error) {
    console.error("Area photo cleanup failed:", error.message);
    return false;
  }
  return true;
}
