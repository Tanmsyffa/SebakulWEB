import type { NextRequest } from 'next/server';
import { z } from 'zod';

export type UploadedImageExtension = 'png' | 'jpg' | 'webp';

const EXTENSION_BY_MIME: Record<string, UploadedImageExtension> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const uuidParamSchema = z.string().uuid();

export function resolveUploadedImageExtension(mimeType: string): UploadedImageExtension | null {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

export function isValidUploadedImageBytes(
  bytes: Uint8Array,
  extension: UploadedImageExtension,
): boolean {
  if (extension === 'png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (extension === 'jpg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}

export function isAllowedSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const expectedHost =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      request.nextUrl.host;
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export function isSafeStorageObjectPath(path: string): boolean {
  return Boolean(path) && !path.includes('..') && !path.startsWith('/') && !path.includes('\\');
}
