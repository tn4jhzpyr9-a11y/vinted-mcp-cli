
const MAX_PHOTOS = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 15000;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^images\d*\.vinted\.net$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function fetchItemPhotoBlocks(photoUrls: string[]) {
  const content: Array<{
    type: 'image';
    data: string;
    mimeType: string;
  }> = [];

  let totalBytes = 0;
  const uniqueUrls = [...new Set(photoUrls)].slice(0, MAX_PHOTOS);

  for (const photoUrl of uniqueUrls) {
    if (!isAllowedUrl(photoUrl)) continue;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TIMEOUT_MS
    );

    try {
      const response = await fetch(photoUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'image/avif,image/webp,image/png,image/jpeg',
        },
      });

      if (!response.ok) continue;

      if (response.status >= 300 && response.status < 400) {
        continue;
      }

      const mimeType = response.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase();

      if (!mimeType || !ALLOWED_TYPES.has(mimeType)) continue;

      const declaredSize = Number(
        response.headers.get('content-length') || 0
      );

      if (
        declaredSize > MAX_IMAGE_BYTES ||
        totalBytes + declaredSize > MAX_TOTAL_BYTES
      ) {
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (
        buffer.length === 0 ||
        buffer.length > MAX_IMAGE_BYTES ||
        totalBytes + buffer.length > MAX_TOTAL_BYTES
      ) {
        continue;
      }

      totalBytes += buffer.length;

      content.push({
        type: 'image',
        data: buffer.toString('base64'),
        mimeType,
      });
    } catch {
      // Ignore unavailable or invalid photos.
    } finally {
      clearTimeout(timeout);
    }
  }

  return content;
}
