const ABSOLUTE_URL_RE = /^(https?:)?\/\//i;

export function resolveImageUrl(url?: string | null): string {
  const value = (url || '').trim();
  if (!value) return '';
  if (ABSOLUTE_URL_RE.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('/imgs/')) return value.replace(/\/{2,}/g, '/');
  if (value.startsWith('imgs/')) return `/${value}`.replace(/\/{2,}/g, '/');
  if (value.startsWith('/')) return value.replace(/\/{2,}/g, '/');
  return `/imgs/${value}`.replace(/\/{2,}/g, '/');
}

export function normalizeUploadedImagePath(path: string): string {
  const value = (path || '').trim();
  if (!value) return '';
  if (ABSOLUTE_URL_RE.test(value) || value.startsWith('/api/')) return value;
  if (value.startsWith('/imgs/')) return value;
  if (value.startsWith('imgs/')) return `/${value}`;
  if (value.startsWith('/')) return `/imgs${value}`;
  return `/imgs/${value}`;
}
