import type { Artwork } from '../artworks/types';
import { formatVnd } from '../artworks/units';

/** Dòng giá trên thẻ / trang tác phẩm. */
export function priceLabel(a: Artwork): string {
  if (a.status === 'sold_out' || a.listingType === 'sold') return 'Đã bán';
  if (a.listingType === 'for_sale') return a.price ? `${formatVnd(a.price)} ₫` : 'Liên hệ';
  if (a.listingType === 'inquire') return 'Hỏi giá';
  return 'Chỉ trưng bày';
}
