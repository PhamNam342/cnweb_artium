import { PageQueryDto } from '@app/common';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ArtworkStatus, ListingType } from '../entities/artwork.enums';

export const ARTWORK_SORTS = [
  'newest',
  'oldest',
  'updated',
  'title',
  'price_asc',
  'price_desc',
] as const;
export type ArtworkSort = (typeof ARTWORK_SORTS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class BaseArtworkQuery extends PageQueryDto {
  /** Tìm theo tên tác phẩm */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsIn(ARTWORK_SORTS)
  sort: ArtworkSort = 'newest';
}

/** Kho tác phẩm của seller. Mặc định ẩn tác phẩm đã lưu trữ. */
export class InventoryQueryDto extends BaseArtworkQuery {
  @IsOptional()
  @IsIn([...Object.values(ArtworkStatus), 'all'])
  status?: ArtworkStatus | 'all';

  /** uuid của thư mục, hoặc "none" = chưa xếp thư mục. Bỏ trống = mọi thư mục. */
  @IsOptional()
  @ValidateIf((_, v) => v !== 'none')
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;
}

/** Danh sách công khai (trang nghệ sĩ, khám phá). Chỉ tác phẩm đã đăng / đã bán. */
export class PublicArtworkQueryDto extends BaseArtworkQuery {
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sellerSlug?: string;

  /** slug của tag, VD: son-dau */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tag?: string;
}
