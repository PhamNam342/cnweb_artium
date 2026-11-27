import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicApi } from '../artworks/artworks-api';
import type { PublicArtwork } from '../artworks/types';
import { formatDimensions, formatVnd, fromKg } from '../artworks/units';
import { useAuth } from '../auth/auth-context';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ApiError } from '../lib/api';
import { ArtCard } from './ArtCard';
import { priceLabel } from './price';

const SHIPPING_LABEL = { box: 'Đóng hộp', crate: 'Đóng thùng gỗ', tube: 'Cuộn trong ống' } as const;

/** Trang chi tiết tác phẩm (người xem). Chủ tác phẩm xem được cả bản nháp để xem trước. */
export function ArtworkPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [a, setA] = useState<PublicArtwork | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [more, setMore] = useState<PublicArtwork[]>([]);

  useEffect(() => {
    let alive = true;
    publicApi
      .get(id)
      .then((res) => {
        if (!alive) return;
        setA(res);
        setActive(0);
        if (res.seller) {
          publicApi
            .list({ sellerSlug: res.seller.slug, pageSize: 5 })
            .then((p) => alive && setMore(p.items.filter((x) => x.id !== res.id).slice(0, 4)))
            .catch(() => undefined);
        }
      })
      .catch(
        (e: unknown) =>
          alive && setError(e instanceof ApiError ? e.message : 'Không tải được tác phẩm'),
      );
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="empty">
        <p className="empty__title">{error}</p>
        <Link to="/home" className="btn btn--outline">
          Về trang Khám phá
        </Link>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="page-center" style={{ minHeight: 320 }} role="status">
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }

  const img = a.images[active] ?? a.coverImage;
  const isOwner = user?.id === a.sellerId;
  const sold = a.status === 'sold_out' || a.listingType === 'sold';
  const facts: [string, string][] = [
    ['Năm sáng tác', a.creationYear ? String(a.creationYear) : '—'],
    ['Chất liệu', a.medium || '—'],
    ['Kích thước', formatDimensions(a)],
    ...(a.weightKg
      ? ([
          [
            'Khối lượng',
            `${String(fromKg(a.weightKg, a.weightUnit)).replace('.', ',')} ${a.weightUnit === 'lb' ? 'lbs' : 'kg'}`,
          ],
        ] as [string, string][])
      : []),
    ['Khung', a.isFramed ? 'Có khung' : 'Không khung'],
    ...(a.edition ? ([['Ấn bản', a.edition]] as [string, string][]) : []),
    ...(a.shipping?.method
      ? ([['Đóng gói', SHIPPING_LABEL[a.shipping.method]]] as [string, string][])
      : []),
  ];

  return (
    <div className="artwork-page">
      <button type="button" className="btn-link back-link" onClick={() => navigate(-1)}>
        <Icon name="arrowLeft" size={16} /> Quay lại
      </button>

      {isOwner && a.status !== 'published' && a.status !== 'sold_out' && (
        <p className="alert alert--info">
          Đây là bản xem trước — tác phẩm đang ở trạng thái nháp, người khác chưa thấy.
        </p>
      )}

      <div className="artwork-page__grid">
        <section className="gallery" aria-label="Ảnh tác phẩm">
          <div className="gallery__main">
            {img ? (
              <img
                src={img.fullUrl}
                alt={a.title}
                onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
              />
            ) : (
              <span>Chưa có ảnh</span>
            )}
          </div>
          {a.images.length > 1 && (
            <div className="gallery__thumbs">
              {a.images.map((im, i) => (
                <button
                  key={im.id}
                  type="button"
                  aria-label={`Ảnh ${i + 1}`}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                >
                  <img src={im.thumbUrl} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="artwork-info">
          {a.seller && (
            <div className="artist-chip">
              <Avatar name={a.seller.displayName} url={a.seller.avatarUrl} size={40} />
              <div>
                <strong>
                  {a.seller.displayName}
                  {a.seller.isVerified && <span className="verified"> ✓</span>}
                </strong>
                <span>artium.vn/{a.seller.slug}</span>
              </div>
            </div>
          )}
          <h1>{a.title}</h1>
          {a.creatorName && a.creatorName !== a.seller?.displayName && (
            <p className="artwork-info__creator">Tác giả: {a.creatorName}</p>
          )}
          <p className="artwork-info__price" data-sold={sold || undefined}>
            {priceLabel(a)}
          </p>
          {a.listingType === 'sold' && a.saleRecord?.soldPrice && (
            <p className="field__hint">
              Đã bán {formatVnd(a.saleRecord.soldPrice)} ₫
              {a.saleRecord.soldAt &&
                ` · ${new Date(a.saleRecord.soldAt).toLocaleDateString('vi-VN')}`}
            </p>
          )}

          {isOwner ? (
            <Link to={`/studio/artworks/${a.id}/edit`} className="btn btn--outline btn--block">
              Sửa tác phẩm
            </Link>
          ) : a.listingType === 'for_sale' && !sold ? (
            <>
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled
                title="Sắp ra mắt"
              >
                Mua ngay
              </button>
              <p className="field__hint">
                Thanh toán qua PayOS sẽ có ở bản tiếp theo.
                {a.quantityTotal > 1 && ` Còn ${a.quantityAvailable}/${a.quantityTotal} bản.`}
              </p>
            </>
          ) : a.listingType === 'inquire' ? (
            <button type="button" className="btn btn--dark btn--block" disabled title="Sắp ra mắt">
              Hỏi giá nghệ sĩ
            </button>
          ) : null}

          {a.description && <p className="artwork-info__desc">{a.description}</p>}

          <dl className="facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {a.tags.length > 0 && (
            <div className="chips">
              {a.tags.map((t) => (
                <Link key={t.id} to={`/home?tag=${t.slug}`} className="chip chip--link">
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>

      {more.length > 0 && a.seller && (
        <section className="more-by" aria-label="Tác phẩm khác của nghệ sĩ">
          <h2>Tác phẩm khác của {a.seller.displayName}</h2>
          <div className="more-by__grid">
            {more.map((x) => (
              <ArtCard key={x.id} a={x} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
