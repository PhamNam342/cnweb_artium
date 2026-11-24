import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SlugAvailability } from '../lib/types';

/** Kiểm tra slug còn trống với backend (debounce 400ms). Slug quá ngắn thì báo ngay, không gọi API. */
export function useSlugCheck(slug: string) {
  const [remote, setRemote] = useState<SlugAvailability | null>(null);
  const tooShort = slug.length < 3;

  useEffect(() => {
    if (tooShort) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<SlugAvailability>('/sellers/slug-availability', { query: { slug }, signal: ctrl.signal })
        .then(setRemote)
        .catch(() => setRemote({ slug, available: false, reason: 'Không kiểm tra được, thử lại' }));
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [slug, tooShort]);

  if (tooShort) {
    return { result: { slug, available: false, reason: 'Cần ít nhất 3 ký tự' }, checking: false };
  }
  const current = remote?.slug === slug ? remote : null;
  return { result: current, checking: current === null };
}
