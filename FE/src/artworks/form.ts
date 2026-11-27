import type {
  Artwork,
  ArtworkInput,
  DimensionUnit,
  ListingType,
  ShippingMethod,
  Tag,
  WeightUnit,
} from './types';
import { formatVnd, fromCm, fromKg, numToInput, parseDecimal, parseVnd, toCm, toKg } from './units';

export const LIMITS = {
  title: 100,
  description: 350,
  edition: 24,
  medium: 80,
  collector: 100,
  images: 10,
  imageBytes: 15 * 1024 * 1024,
  maxDimension: 100_000,
  minPrice: 1_000,
  maxPrice: 100_000_000_000,
  maxQuantity: 10_000,
};

export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];

/** Ảnh trong wizard: đã có trên server, đang tải, đã tải xong, hoặc lỗi. */
export interface ImageItem {
  key: string;
  /** Ảnh xem trước: URL Cloudinary hoặc blob: của file đang tải */
  previewUrl: string;
  fileName?: string;
  status: 'saved' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
  publicId?: string;
  version?: number;
  signature?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

/** Giá trị form dạng chuỗi (đúng như người dùng gõ) — chỉ đổi sang số khi gửi. */
export interface ArtworkForm {
  title: string;
  description: string;
  year: string;
  edition: string;
  medium: string;
  dimensionUnit: DimensionUnit;
  height: string;
  width: string;
  depth: string;
  weightUnit: WeightUnit;
  weight: string;
  isFramed: boolean;
  folderId: string;
  listingType: ListingType;
  price: string;
  quantity: string;
  allowOffers: boolean;
  collectorName: string;
  showSale: boolean;
  soldPrice: string;
  soldAt: string;
  shippingMethod: ShippingMethod;
  pkgHeight: string;
  pkgWidth: string;
  pkgDepth: string;
  pkgWeight: string;
  tagIds: string[];
}

export const emptyForm = (): ArtworkForm => ({
  title: '',
  description: '',
  year: '',
  edition: '',
  medium: '',
  dimensionUnit: 'cm',
  height: '',
  width: '',
  depth: '',
  weightUnit: 'kg',
  weight: '',
  isFramed: false,
  folderId: '',
  listingType: 'for_sale',
  price: '',
  quantity: '1',
  allowOffers: false,
  collectorName: '',
  showSale: false,
  soldPrice: '',
  soldAt: '',
  shippingMethod: 'box',
  pkgHeight: '',
  pkgWidth: '',
  pkgDepth: '',
  pkgWeight: '',
  tagIds: [],
});

/** Tác phẩm từ API → form (đổi cm/kg sang đơn vị người dùng đã chọn). */
export function formFromArtwork(a: Artwork): ArtworkForm {
  const du = a.dimensionUnit;
  const wu = a.weightUnit;
  const s = a.shipping ?? {};
  const sale = a.saleRecord ?? {};
  return {
    title: a.title,
    description: a.description ?? '',
    year: a.creationYear ? String(a.creationYear) : '',
    edition: a.edition ?? '',
    medium: a.medium ?? '',
    dimensionUnit: du,
    height: numToInput(fromCm(a.heightCm, du)),
    width: numToInput(fromCm(a.widthCm, du)),
    depth: numToInput(fromCm(a.depthCm, du)),
    weightUnit: wu,
    weight: numToInput(fromKg(a.weightKg, wu)),
    isFramed: a.isFramed,
    folderId: a.folderId ?? '',
    listingType: a.listingType,
    price: formatVnd(a.price),
    quantity: String(a.quantityTotal),
    allowOffers: a.allowOffers,
    collectorName: sale.collectorName ?? '',
    showSale: sale.showOnProfile ?? false,
    soldPrice: formatVnd(sale.soldPrice),
    soldAt: sale.soldAt ?? '',
    shippingMethod: s.method ?? 'box',
    pkgHeight: numToInput(fromCm(s.heightCm, du)),
    pkgWidth: numToInput(fromCm(s.widthCm, du)),
    pkgDepth: numToInput(fromCm(s.depthCm, du)),
    pkgWeight: numToInput(fromKg(s.weightKg, wu)),
    tagIds: a.tags.map((t) => t.id),
  };
}

export const imagesFromArtwork = (a: Artwork): ImageItem[] =>
  a.images.map((i) => ({
    key: i.publicId,
    previewUrl: i.thumbUrl,
    status: 'saved',
    progress: 100,
    publicId: i.publicId,
    width: i.width,
    height: i.height,
  }));

/** Nơi giao hàng có ý nghĩa: tác phẩm còn có thể bán. */
export const hasShipping = (t: ListingType) => t === 'for_sale' || t === 'inquire';

const nullIfEmpty = (s: string) => (s.trim() === '' ? null : s.trim());

/** Form → body gửi API (giả định đã validate). */
export function toArtworkInput(f: ArtworkForm): ArtworkInput {
  const du = f.dimensionUnit;
  const wu = f.weightUnit;
  const dim = (s: string) => toCm(parseDecimal(s), du);
  const kg = (s: string) => toKg(parseDecimal(s), wu);
  const shipping = hasShipping(f.listingType)
    ? Object.fromEntries(
        Object.entries({
          method: f.shippingMethod,
          heightCm: dim(f.pkgHeight),
          widthCm: dim(f.pkgWidth),
          depthCm: dim(f.pkgDepth),
          weightKg: kg(f.pkgWeight),
        }).filter(([, v]) => v !== null),
      )
    : null;
  return {
    title: f.title.trim(),
    description: nullIfEmpty(f.description),
    creationYear: f.year ? Number(f.year) : null,
    edition: nullIfEmpty(f.edition),
    medium: nullIfEmpty(f.medium),
    heightCm: dim(f.height),
    widthCm: dim(f.width),
    depthCm: dim(f.depth),
    dimensionUnit: du,
    weightKg: kg(f.weight),
    weightUnit: wu,
    isFramed: f.isFramed,
    listingType: f.listingType,
    price: f.listingType === 'for_sale' || f.listingType === 'inquire' ? parseVnd(f.price) : null,
    quantityTotal:
      f.listingType === 'for_sale' ? Number(f.quantity) : Math.max(1, Number(f.quantity) || 1),
    allowOffers: f.listingType === 'for_sale' && f.allowOffers,
    shipping,
    saleRecord:
      f.listingType === 'sold'
        ? {
            collectorName: nullIfEmpty(f.collectorName),
            showOnProfile: f.showSale,
            soldPrice: f.showSale ? parseVnd(f.soldPrice) : null,
            soldAt: f.showSale ? f.soldAt : null,
          }
        : null,
    folderId: f.folderId || null,
    tagIds: f.tagIds,
  };
}

export type FormErrors = Partial<Record<keyof ArtworkForm | 'images', string>>;

const today = () => new Date().toISOString().slice(0, 10);

function checkDecimal(errors: FormErrors, key: keyof ArtworkForm, value: string, unitMax: number) {
  const n = parseDecimal(value);
  if (n === null) return;
  if (Number.isNaN(n) || n <= 0) errors[key] = 'Nhập số lớn hơn 0';
  else if (n > unitMax) errors[key] = 'Giá trị quá lớn';
  else if (!/^\d+([.,]\d{1,2})?$/.test(value.trim())) errors[key] = 'Tối đa 2 chữ số thập phân';
}

function checkVnd(
  errors: FormErrors,
  key: keyof ArtworkForm,
  value: string,
  required: string | null,
) {
  const n = parseVnd(value);
  if (n === null) {
    if (required) errors[key] = required;
    return;
  }
  if (n < LIMITS.minPrice) errors[key] = `Tối thiểu ${formatVnd(LIMITS.minPrice)} ₫`;
  else if (n > LIMITS.maxPrice) errors[key] = 'Giá quá lớn';
}

export function validateImages(images: ImageItem[]): FormErrors {
  if (images.length === 0) return { images: 'Thêm ít nhất 1 ảnh tác phẩm' };
  if (images.some((i) => i.status === 'uploading')) return { images: 'Chờ ảnh tải lên xong' };
  if (images.some((i) => i.status === 'error'))
    return { images: 'Xóa hoặc tải lại các ảnh bị lỗi' };
  return {};
}

export function validateDetails(f: ArtworkForm): FormErrors {
  const e: FormErrors = {};
  if (!f.title.trim()) e.title = 'Nhập tên tác phẩm';
  if (f.title.trim().length > LIMITS.title) e.title = `Tối đa ${LIMITS.title} ký tự`;
  if (f.description.length > LIMITS.description)
    e.description = `Tối đa ${LIMITS.description} ký tự`;
  if (f.edition.length > LIMITS.edition) e.edition = `Tối đa ${LIMITS.edition} ký tự`;
  if (f.medium.length > LIMITS.medium) e.medium = `Tối đa ${LIMITS.medium} ký tự`;
  if (f.year) {
    const y = Number(f.year);
    if (!/^\d{4}$/.test(f.year) || y < 1000 || y > new Date().getFullYear() + 1) {
      e.year = 'Năm không hợp lệ';
    }
  }
  const maxDim = f.dimensionUnit === 'in' ? LIMITS.maxDimension / 2.54 : LIMITS.maxDimension;
  checkDecimal(e, 'height', f.height, maxDim);
  checkDecimal(e, 'width', f.width, maxDim);
  checkDecimal(e, 'depth', f.depth, maxDim);
  checkDecimal(e, 'weight', f.weight, 100_000);

  if (f.listingType === 'for_sale') {
    checkVnd(e, 'price', f.price, 'Nhập giá bán');
    const q = Number(f.quantity);
    if (!/^\d+$/.test(f.quantity) || q < 1) e.quantity = 'Số lượng ít nhất là 1';
    else if (q > LIMITS.maxQuantity) e.quantity = `Tối đa ${formatVnd(LIMITS.maxQuantity)}`;
  }
  if (f.listingType === 'inquire') checkVnd(e, 'price', f.price, null);
  if (f.listingType === 'sold') {
    if (f.collectorName.length > LIMITS.collector)
      e.collectorName = `Tối đa ${LIMITS.collector} ký tự`;
    if (f.showSale) {
      checkVnd(e, 'soldPrice', f.soldPrice, 'Nhập giá đã bán');
      if (!f.soldAt) e.soldAt = 'Chọn ngày bán';
      else if (f.soldAt > today()) e.soldAt = 'Ngày bán không được ở tương lai';
    }
  }
  if (hasShipping(f.listingType)) {
    checkDecimal(e, 'pkgHeight', f.pkgHeight, maxDim);
    checkDecimal(e, 'pkgWidth', f.pkgWidth, maxDim);
    checkDecimal(e, 'pkgDepth', f.pkgDepth, maxDim);
    checkDecimal(e, 'pkgWeight', f.pkgWeight, 100_000);
  }
  return e;
}

/** Theo Figma: cần chọn ít nhất 1 chất liệu trước khi đăng. */
export function validateTags(f: ArtworkForm, tags: Tag[]): FormErrors {
  const selected = tags.filter((t) => f.tagIds.includes(t.id));
  if (!selected.some((t) => t.category === 'medium')) return { tagIds: 'Chọn ít nhất 1 chất liệu' };
  if (f.tagIds.length > 20) return { tagIds: 'Tối đa 20 tag' };
  return {};
}

export const LISTING_OPTIONS: { id: ListingType; label: string; hint: string }[] = [
  { id: 'for_sale', label: 'Bán', hint: 'Người mua đặt hàng và thanh toán trực tiếp qua Artium.' },
  { id: 'inquire', label: 'Hỏi giá', hint: 'Người quan tâm gửi yêu cầu, bạn trao đổi giá với họ.' },
  {
    id: 'sold',
    label: 'Đã bán',
    hint: 'Đã bán ở nơi khác — vẫn hiển thị trong portfolio của bạn.',
  },
  { id: 'display_only', label: 'Chỉ trưng bày', hint: 'Chỉ giới thiệu tác phẩm, không bán.' },
];

export const SHIPPING_OPTIONS: { id: ShippingMethod; label: string }[] = [
  { id: 'box', label: 'Đóng hộp' },
  { id: 'crate', label: 'Đóng thùng gỗ' },
  { id: 'tube', label: 'Cuộn trong ống' },
];

export const TAG_GROUPS: { id: Tag['category']; label: string; hint: string }[] = [
  { id: 'medium', label: 'Chất liệu', hint: 'Chọn ít nhất 1 chất liệu' },
  { id: 'style', label: 'Phong cách', hint: 'Giúp người xem tìm thấy tác phẩm theo gu' },
  { id: 'subject', label: 'Chủ đề', hint: '' },
  { id: 'other', label: 'Tag riêng của bạn', hint: '' },
];

export const STATUS_LABEL: Record<Artwork['status'], string> = {
  draft: 'Nháp',
  published: 'Đang hiển thị',
  sold_out: 'Hết hàng',
  archived: 'Lưu trữ',
};

export const LISTING_LABEL: Record<ListingType, string> = {
  for_sale: 'Đang bán',
  inquire: 'Hỏi giá',
  sold: 'Đã bán',
  display_only: 'Chỉ trưng bày',
};
