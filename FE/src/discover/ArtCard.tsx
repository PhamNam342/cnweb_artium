import { Link } from 'react-router-dom';
import type { PublicArtwork } from '../artworks/types';
import { priceLabel } from './price';

/** Thẻ tác phẩm trên lưới Khám phá: ảnh giữ đúng tỉ lệ gốc (lưới kiểu masonry). */
export function ArtCard({ a }: { a: PublicArtwork }) {
  const cover = a.coverImage;
  const ratio = cover ? `${cover.width} / ${cover.height}` : '4 / 5';
  const sold = a.status === 'sold_out' || a.listingType === 'sold';
  return (
    <article className="d-card">
      <Link to={`/artworks/${a.id}`} className="d-card__img" style={{ aspectRatio: ratio }}>
        {cover ? (
          <img
            src={cover.url}
            alt={a.title}
            loading="lazy"
            onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
          />
        ) : (
          <span>Chưa có ảnh</span>
        )}
        {sold && <span className="d-card__flag">Đã bán</span>}
      </Link>
      <div className="d-card__body">
        <h3>
          <Link to={`/artworks/${a.id}`}>{a.title}</Link>
        </h3>
        <p className="d-card__artist">
          {a.seller?.displayName ?? a.creatorName ?? 'Nghệ sĩ'}
          {a.seller?.isVerified && (
            <span className="verified" title="Nghệ sĩ đã xác minh" aria-label="đã xác minh">
              ✓
            </span>
          )}
        </p>
        <p className="d-card__meta">{[a.creationYear, a.medium].filter(Boolean).join(' · ')}</p>
        <p className="d-card__price" data-sold={sold || undefined}>
          {priceLabel(a)}
        </p>
      </div>
    </article>
  );
}
