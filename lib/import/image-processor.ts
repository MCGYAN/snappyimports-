/**
 * Upload product images to Supabase Storage and build a map of filename -> public URL.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  PRODUCT_IMPORT_MAX_BYTES,
  randomImagePath,
  sanitizeUploadedImage,
  SecureImageError,
} from '@/lib/secure-image';

const BUCKET = 'products';

export interface UploadProgress {
  current: number;
  total: number;
  message: string;
}

export async function uploadProductImages(
  images: Map<string, Buffer>,
  referencedNames: Set<string>,
  prefix: string,
  onProgress?: (p: UploadProgress) => void
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const toUpload = Array.from(referencedNames).filter((name) => images.has(name));
  const total = toUpload.length;
  let current = 0;

  for (const filename of toUpload) {
    const buf = images.get(filename)!;
    if (buf.length > PRODUCT_IMPORT_MAX_BYTES) {
      onProgress?.({
        current: ++current,
        total,
        message: `Skipped ${filename}: exceeds 10MB`,
      });
      continue;
    }

    try {
      const safe = await sanitizeUploadedImage(buf, 'product', PRODUCT_IMPORT_MAX_BYTES);
      const path = randomImagePath(`imports/${prefix}`, safe.extension);
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, safe.buffer, {
        contentType: safe.contentType,
        upsert: false,
      });

      if (error) {
        onProgress?.({
          current: ++current,
          total,
          message: `Failed ${filename}: ${error.message}`,
        });
        continue;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      urlMap.set(filename.toLowerCase().trim(), publicUrl);
      urlMap.set(filename, publicUrl);
      current++;
      onProgress?.({
        current,
        total,
        message: `Uploaded ${filename}`,
      });
    } catch (error) {
      const reason =
        error instanceof SecureImageError ? error.message : 'unsupported or unsafe image';
      onProgress?.({
        current: ++current,
        total,
        message: `Skipped ${filename}: ${reason}`,
      });
    }
  }

  return urlMap;
}

export function collectReferencedImageNames(rows: { images?: string[]; variant_image?: string }[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    for (const f of row.images ?? []) {
      if (f.trim()) set.add(f.toLowerCase().trim());
    }
    if (row.variant_image?.trim()) {
      set.add(row.variant_image.toLowerCase().trim());
    }
  }
  return set;
}
