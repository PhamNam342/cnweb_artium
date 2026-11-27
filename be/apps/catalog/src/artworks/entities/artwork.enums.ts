export enum ArtworkStatus {
  Draft = 'draft',
  Published = 'published',
  SoldOut = 'sold_out',
  Archived = 'archived',
}

export enum ListingType {
  ForSale = 'for_sale',
  Inquire = 'inquire',
  DisplayOnly = 'display_only',
  /** Đã bán ngoài nền tảng — vẫn hiển thị trong portfolio, không mua được. */
  Sold = 'sold',
}

export enum DimensionUnit {
  Cm = 'cm',
  In = 'in',
}

export enum WeightUnit {
  Kg = 'kg',
  Lb = 'lb',
}

export enum ShippingMethod {
  Box = 'box',
  Crate = 'crate',
  Tube = 'tube',
}

/** Thông tin bán ngoài nền tảng (listingType = sold). */
export interface ArtworkSaleRecord {
  /** Chỉ chủ tác phẩm thấy */
  collectorName?: string | null;
  /** Hiện giá + ngày bán trên hồ sơ nghệ sĩ */
  showOnProfile: boolean;
  soldPrice?: number | null;
  /** YYYY-MM-DD */
  soldAt?: string | null;
}

export interface ArtworkShipping {
  method?: ShippingMethod;
  widthCm?: number;
  heightCm?: number;
  depthCm?: number;
  weightKg?: number;
}
