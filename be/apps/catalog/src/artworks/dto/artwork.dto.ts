import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ALLOWED_IMAGE_FORMATS } from '@app/storage';
import {
  DimensionUnit,
  ListingType,
  ShippingMethod,
  WeightUnit,
} from '../entities/artwork.enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Cho phép gửi null để xóa giá trị. */
const notNull = (_: object, v: unknown) => v !== null;
const MAX_CM = 100_000;
export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export class ShippingDto {
  @IsOptional()
  @IsEnum(ShippingMethod)
  method?: ShippingMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  widthCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  heightCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  depthCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weightKg?: number;
}

/** Thông tin bán ngoài nền tảng — dùng khi listingType = sold. */
export class SaleRecordDto {
  @IsOptional()
  @ValidateIf(notNull)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  collectorName?: string | null;

  /** Hiện giá + ngày bán trên hồ sơ. Bật thì bắt buộc soldPrice và soldAt. */
  @IsBoolean()
  showOnProfile!: boolean;

  @ValidateIf(
    (o: SaleRecordDto) => o.showOnProfile || (o.soldPrice ?? null) !== null,
  )
  @IsInt()
  @Min(1_000)
  @Max(100_000_000_000)
  soldPrice?: number | null;

  /** YYYY-MM-DD, không ở tương lai */
  @ValidateIf(
    (o: SaleRecordDto) => o.showOnProfile || (o.soldAt ?? null) !== null,
  )
  @IsDateString({ strict: true })
  soldAt?: string | null;
}

/** Ảnh gửi lên khi tạo/sửa. Ảnh mới cần đủ thông tin Cloudinary trả về (kèm chữ ký). */
export class ArtworkImageInputDto {
  @IsString()
  @MaxLength(255)
  publicId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  /** Chữ ký trong response upload của Cloudinary — bắt buộc với ảnh mới. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signature?: string;

  @IsOptional()
  @IsIn(ALLOWED_IMAGE_FORMATS)
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_BYTES)
  bytes?: number;
}

export class ArtworkInputDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  title!: string;

  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(350)
  description?: string | null;

  @IsOptional()
  @ValidateIf(notNull)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  creatorName?: string | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(1000)
  @Max(new Date().getFullYear() + 1)
  creationYear?: number | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(24)
  edition?: string | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(80)
  medium?: string | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  widthCm?: number | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  heightCm?: number | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CM)
  depthCm?: number | null;

  @IsOptional()
  @IsEnum(DimensionUnit)
  dimensionUnit?: DimensionUnit;

  @IsOptional()
  @ValidateIf(notNull)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weightKg?: number | null;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @IsOptional()
  @IsBoolean()
  isFramed?: boolean;

  @ApiProperty({ enum: ListingType, required: false })
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  /** VND, số nguyên. Bắt buộc khi đăng với listingType = for_sale. */
  @IsOptional()
  @ValidateIf(notNull)
  @IsInt()
  @Min(1_000)
  @Max(100_000_000_000)
  price?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantityTotal?: number;

  @IsOptional()
  @IsBoolean()
  allowOffers?: boolean;

  @IsOptional()
  @ValidateIf(notNull)
  @ValidateNested()
  @Type(() => ShippingDto)
  shipping?: ShippingDto | null;

  @IsOptional()
  @ValidateIf(notNull)
  @ValidateNested()
  @Type(() => SaleRecordDto)
  saleRecord?: SaleRecordDto | null;

  @IsOptional()
  @ValidateIf(notNull)
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tagIds?: string[];
}

export class CreateArtworkDto extends ArtworkInputDto {
  /** Có thể gửi luôn ảnh khi tạo (thứ tự = vị trí, ảnh đầu là ảnh bìa). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => ArtworkImageInputDto)
  images?: ArtworkImageInputDto[];
}

export class UpdateArtworkDto extends PartialType(
  OmitType(ArtworkInputDto, [] as const),
) {}

export class ReplaceImagesDto {
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => ArtworkImageInputDto)
  images!: ArtworkImageInputDto[];
}

export class UploadTicketDto {
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGES)
  count!: number;
}

export enum BulkAction {
  Move = 'move',
  Archive = 'archive',
  Unpublish = 'unpublish',
}

export class BulkArtworkDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsEnum(BulkAction)
  action!: BulkAction;

  /** Với action = move. null = đưa ra ngoài thư mục. */
  @IsOptional()
  @ValidateIf(notNull)
  @IsUUID()
  folderId?: string | null;
}
