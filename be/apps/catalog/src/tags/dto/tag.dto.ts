import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { TagCategory } from '../entities/tag.entity';

export class TagQueryDto {
  @IsOptional()
  @IsEnum(TagCategory)
  category?: TagCategory;

  /** system = chỉ tag hệ thống; mine = chỉ tag của tôi; all (mặc định) = hệ thống + của tôi */
  @IsOptional()
  @IsIn(['all', 'system', 'mine'])
  scope: 'all' | 'system' | 'mine' = 'all';
}

export class CreateTagDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Length(2, 64)
  name!: string;

  @IsOptional()
  @IsEnum(TagCategory)
  category?: TagCategory;
}
