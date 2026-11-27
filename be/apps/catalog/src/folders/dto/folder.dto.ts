import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFolderDto {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId?: string | null;
}

export class UpdateFolderDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  name?: string;

  /** null = đưa lên cấp gốc */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  position?: number;

  /** Ẩn thư mục khỏi trang công khai của nghệ sĩ */
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
