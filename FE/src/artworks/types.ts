/** Khớp với ArtworkResponse / TagResponse / FolderResponse của catalog service. */
export type ArtworkStatus = 'draft' | 'published' | 'sold_out' | 'archived';
export type ListingType = 'for_sale' | 'inquire' | 'sold' | 'display_only';
export type DimensionUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';
export type ShippingMethod = 'box' | 'crate' | 'tube';
export type TagCategory = 'medium' | 'style' | 'subject' | 'other';

export interface ArtworkImage {
  id: string;
  publicId: string;
  version: number;
  width: number;
  height: number;
  position: number;
  thumbUrl: string;
  url: string;
  fullUrl: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
  isSystem: boolean;
}

export interface SaleRecord {
  collectorName?: string | null;
  showOnProfile?: boolean;
  soldPrice?: number | null;
  soldAt?: string | null;
}

export interface Shipping {
  method?: ShippingMethod;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  weightKg?: number;
}

export interface Artwork {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  creatorName: string | null;
  creationYear: number | null;
  edition: string | null;
  medium: string | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  dimensionUnit: DimensionUnit;
  weightKg: number | null;
  weightUnit: WeightUnit;
  isFramed: boolean;
  listingType: ListingType;
  price: number | null;
  quantityTotal: number;
  quantityAvailable: number;
  allowOffers: boolean;
  shipping: Shipping | null;
  saleRecord: SaleRecord | null;
  status: ArtworkStatus;
  publishedAt: string | null;
  coverImage: ArtworkImage | null;
  images: ArtworkImage[];
  tags: Tag[];
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerSummary {
  sellerId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

/** Tác phẩm như người xem thấy: kèm thông tin nghệ sĩ. */
export interface PublicArtwork extends Artwork {
  seller: SellerSummary | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InventoryPage extends Page<Artwork> {
  counts: Record<ArtworkStatus, number>;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  isHidden: boolean;
  artworkCount: number;
}

/** Ảnh gửi lên khi tạo/sửa: ảnh cũ chỉ cần publicId, ảnh mới cần đủ kết quả Cloudinary. */
export interface ImageInput {
  publicId: string;
  version?: number;
  signature?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface ArtworkInput {
  title: string;
  description: string | null;
  creationYear: number | null;
  edition: string | null;
  medium: string | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  dimensionUnit: DimensionUnit;
  weightKg: number | null;
  weightUnit: WeightUnit;
  isFramed: boolean;
  listingType: ListingType;
  price: number | null;
  quantityTotal: number;
  allowOffers: boolean;
  shipping: Shipping | null;
  saleRecord: SaleRecord | null;
  folderId: string | null;
  tagIds: string[];
}

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  allowedFormats: string;
  expiresAt: string;
  maxBytes: number;
  items: { publicId: string; timestamp: number; signature: string }[];
}
