import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicApi } from '../artworks/artworks-api';
import type { PublicArtwork, Tag } from '../artworks/types';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../lib/api';
import { ArtCard } from './ArtCard';

const PAGE_SIZE = 24;
const SORTS = [
  { id: 'newest', label: 'Mới đăng' },
  { id: 'price_asc', label: 'Giá tăng dần' },
  { id: 'price_desc', label: 'Giá giảm dần' },
  { id: 'title', label: 'Tên A → Z' },
];
const LISTINGS = [
  { id: '', label: 'Tất cả' },
  { id: 'for_sale', label: 'Đang bán' },
  { id: 'inquire', label: 'Hỏi giá' },
  { id: 'display_only', label: 'Trưng bày' },
];

/** Trang Khám phá (trang chính sau đăng nhập): tác phẩm đã đăng của mọi nghệ sĩ. */
export function DiscoverPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const listingType = params.get('type') ?? '';

  const [tags, setTags] = useState<Tag[]>([]);
  const [items, setItems] = useState<PublicArtwork[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = `${q}|${tag}|${sort}|${listingType}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    publicApi.systemTags().then(setTags, () => setTags([]));
  }, []);

  // Đổi bộ lọc → tải lại từ trang 1; bấm "Xem thêm" → nối thêm trang tiếp theo
  const effectivePage = loadedKey === filterKey ? page : 1;
  useEffect(() => {
    const ctrl = new AbortController();
    publicApi
      .list(
        {
          q: q || undefined,
          tag: tag || undefined,
          sort,
          listingType: listingType || undefined,
          page: effectivePage,
          pageSize: PAGE_SIZE,
        },
        ctrl.signal,
      )
      .then((res) => {
        setError(null);
        setItems((prev) => (effectivePage === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(effectivePage);
        setLoadedKey(filterKey);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === 'AbortError') return;
        setError(e instanceof ApiError ? e.message : 'Không tải được tác phẩm');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [filterKey, effectivePage]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setLoading(true);
    setParams(p);
  };

  // Chip tag: sở thích của người dùng lên đầu, rồi đến chất liệu, phong cách, chủ đề
  const chips = useMemo(() => {
    const interests = new Set(user?.interests ?? []);
    const order = { medium: 1, style: 2, subject: 3, other: 4 };
    return [...tags].sort(
      (a, b) =>
        Number(interests.has(b.slug)) - Number(interests.has(a.slug)) ||
        order[a.category] - order[b.category],
    );
  }, [tags, user?.interests]);

  const tagName = tags.find((t) => t.slug === tag)?.name;
  const hasMore = total !== null && items.length < total;
  const filtering = Boolean(q || tag || listingType);

  return (
    <div className="discover">
      <header className="discover__head">
        <div>
          <h1>Khám phá</h1>
          <p>
            {q
              ? `Kết quả cho “${q}”`
              : tagName
                ? `Tác phẩm ${tagName.toLowerCase()}`
                : 'Tác phẩm mới nhất từ các nghệ sĩ trên Artium'}
            {total !== null && !loading && ` · ${total} tác phẩm`}
          </p>
        </div>
        <div className="discover__controls">
          <div className="tabs" role="tablist" aria-label="Hình thức">
            {LISTINGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                className="tab"
                aria-selected={listingType === l.id}
                onClick={() => update({ type: l.id })}
              >
                {l.label}
              </button>
            ))}
          </div>
          <select
            className="input input--sm"
            aria-label="Sắp xếp"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="chip-scroller" role="group" aria-label="Lọc theo thể loại">
        <button
          type="button"
          className="chip"
          aria-pressed={!tag}
          onClick={() => update({ tag: '' })}
        >
          Tất cả
        </button>
        {chips.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={tag === t.slug}
            onClick={() => update({ tag: tag === t.slug ? '' : t.slug })}
          >
            {t.name}
          </button>
        ))}
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="masonry" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="d-card d-card--ghost"
              style={{ aspectRatio: i % 3 ? '4 / 5' : '1 / 1' }}
            />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="empty">
          <p className="empty__title">
            {filtering ? 'Không có tác phẩm nào khớp bộ lọc.' : 'Chưa có tác phẩm nào được đăng.'}
          </p>
          {filtering ? (
            <button type="button" className="btn btn--outline" onClick={() => setParams({})}>
              Xóa bộ lọc
            </button>
          ) : (
            user?.role === 'seller' && (
              <Link to="/studio/artworks/new" className="btn btn--primary">
                Đăng tác phẩm đầu tiên
              </Link>
            )
          )}
        </div>
      ) : (
        <div className="masonry" aria-busy={loading || undefined} data-dim={loading || undefined}>
          {items.map((a) => (
            <ArtCard key={a.id} a={a} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="discover__more">
          <button
            type="button"
            className="btn btn--outline"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            {loading ? 'Đang tải…' : 'Xem thêm'}
          </button>
        </div>
      )}
    </div>
  );
}
