import { ArtworkStatus, ListingType } from './entities/artwork.enums';
import { Artwork } from './entities/artwork.entity';

/** Trạng thái người ngoài xem được. */
export const PUBLIC_STATUSES = [ArtworkStatus.Published, ArtworkStatus.SoldOut];

export const isPublic = (s: ArtworkStatus) => PUBLIC_STATUSES.includes(s);

/**
 * Điều kiện để một tác phẩm được hiển thị công khai. Trả về danh sách lỗi (rỗng = hợp lệ).
 * Dùng cả khi publish lẫn khi sửa tác phẩm đang công khai.
 */
export function publishProblems(a: Artwork, imageCount: number): string[] {
  const errors: string[] = [];
  if (!a.title?.trim()) errors.push('Tác phẩm cần có tên');
  if (imageCount < 1) errors.push('Tác phẩm cần ít nhất 1 ảnh');
  if (a.listingType === ListingType.ForSale) {
    if (!a.price || a.price <= 0)
      errors.push('Tác phẩm bán cần có giá lớn hơn 0');
    if (a.quantityTotal < 1) errors.push('Tác phẩm bán cần số lượng ít nhất 1');
  }
  return errors;
}

/** Sau khi số lượng còn lại thay đổi: tự chuyển giữa published ⇄ sold_out. */
export function syncSoldOut(a: Artwork): void {
  if (a.listingType !== ListingType.ForSale) {
    if (a.status === ArtworkStatus.SoldOut) a.status = ArtworkStatus.Published;
    return;
  }
  if (a.status === ArtworkStatus.Published && a.quantityAvailable === 0) {
    a.status = ArtworkStatus.SoldOut;
  } else if (a.status === ArtworkStatus.SoldOut && a.quantityAvailable > 0) {
    a.status = ArtworkStatus.Published;
  }
}
