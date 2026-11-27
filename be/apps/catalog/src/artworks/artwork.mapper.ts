import { CloudinaryService } from '@app/storage';
import { SellerSummary } from '../sellers/seller-summary.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ArtworkImage } from './entities/artwork-image.entity';
import { Artwork } from './entities/artwork.entity';
import {
  ArtworkSaleRecord,
  ArtworkShipping,
  ListingType,
} from './entities/artwork.enums';

export class ArtworkImageResponse {
  id!: string;
  publicId!: string;
  version!: number;
  width!: number;
  height!: number;
  position!: number;
  /** 400×400 cắt vừa — cho lưới, danh sách */
  thumbUrl!: string;
  /** Rộng tối đa 1200px — cho trang chi tiết */
  url!: string;
  /** Rộng tối đa 2400px — xem phóng to */
  fullUrl!: string;
}

export class TagResponse {
  id!: string;
  name!: string;
  slug!: string;
  category!: string;
  isSystem!: boolean;
}

export class SellerSummaryResponse {
  sellerId!: string;
  slug!: string;
  displayName!: string;
  avatarUrl!: string | null;
  isVerified!: boolean;
}

export class ArtworkResponse {
  id!: string;
  sellerId!: string;
  seller!: SellerSummaryResponse | null;
  title!: string;
  description!: string | null;
  creatorName!: string | null;
  creationYear!: number | null;
  edition!: string | null;
  medium!: string | null;
  /** Kích thước luôn theo cm/kg; dimensionUnit/weightUnit là đơn vị người dùng chọn để hiển thị. */
  widthCm!: number | null;
  heightCm!: number | null;
  depthCm!: number | null;
  dimensionUnit!: string;
  weightKg!: number | null;
  weightUnit!: string;
  isFramed!: boolean;
  listingType!: string;
  price!: number | null;
  currency!: 'VND';
  quantityTotal!: number;
  quantityAvailable!: number;
  allowOffers!: boolean;
  shipping!: ArtworkShipping | null;
  /** Chỉ có khi listingType = sold. Người ngoài chỉ thấy giá + ngày khi showOnProfile. */
  saleRecord!: Partial<ArtworkSaleRecord> | null;
  status!: string;
  publishedAt!: Date | null;
  coverImage!: ArtworkImageResponse | null;
  images!: ArtworkImageResponse[];
  tags!: TagResponse[];
  likeCount!: number;
  commentCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
  /** Chỉ chủ tác phẩm thấy */
  folderId?: string | null;
}

export class ArtworkMapper {
  constructor(private readonly cloudinary: CloudinaryService) {}

  image(i: ArtworkImage): ArtworkImageResponse {
    return {
      id: i.id,
      publicId: i.publicId,
      version: i.version,
      width: i.width,
      height: i.height,
      position: i.position,
      thumbUrl: this.cloudinary.imageUrl(i.publicId, i.version, 'thumb'),
      url: this.cloudinary.imageUrl(i.publicId, i.version, 'medium'),
      fullUrl: this.cloudinary.imageUrl(i.publicId, i.version, 'full'),
    };
  }

  tag(t: Tag): TagResponse {
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      category: t.category,
      isSystem: t.sellerId === null,
    };
  }

  seller(s: SellerSummary | null | undefined): SellerSummaryResponse | null {
    if (!s) return null;
    return {
      sellerId: s.sellerId,
      slug: s.slug,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl,
      isVerified: s.isVerified,
    };
  }

  saleRecord(
    r: ArtworkSaleRecord | null,
    isOwner: boolean,
  ): Partial<ArtworkSaleRecord> | null {
    if (!r) return null;
    if (isOwner) return r;
    return r.showOnProfile ? { soldPrice: r.soldPrice, soldAt: r.soldAt } : {};
  }

  artwork(
    a: Artwork,
    opts: {
      images: ArtworkImage[];
      tags: Tag[];
      seller?: SellerSummary | null;
      isOwner: boolean;
    },
  ): ArtworkResponse {
    const images = [...opts.images]
      .sort((x, y) => x.position - y.position)
      .map((i) => this.image(i));
    return {
      id: a.id,
      sellerId: a.sellerId,
      seller: this.seller(opts.seller),
      title: a.title,
      description: a.description,
      creatorName: a.creatorName,
      creationYear: a.creationYear,
      edition: a.edition,
      medium: a.medium,
      widthCm: a.widthCm,
      heightCm: a.heightCm,
      depthCm: a.depthCm,
      dimensionUnit: a.dimensionUnit,
      weightKg: a.weightKg,
      weightUnit: a.weightUnit,
      isFramed: a.isFramed,
      listingType: a.listingType,
      // Hỏi giá: giá chỉ là ghi chú riêng của nghệ sĩ
      price:
        a.listingType === ListingType.Inquire && !opts.isOwner ? null : a.price,
      currency: 'VND',
      quantityTotal: a.quantityTotal,
      quantityAvailable: a.quantityAvailable,
      allowOffers: a.allowOffers,
      shipping: a.shipping,
      saleRecord: this.saleRecord(a.saleRecord, opts.isOwner),
      status: a.status,
      publishedAt: a.publishedAt,
      coverImage: images[0] ?? null,
      images,
      tags: opts.tags.map((t) => this.tag(t)),
      likeCount: a.likeCount,
      commentCount: a.commentCount,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      ...(opts.isOwner ? { folderId: a.folderId } : {}),
    };
  }
}
