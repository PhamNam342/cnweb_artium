import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkFolder } from '../folders/artwork-folder.entity';
import { SellerSummary } from '../sellers/seller-summary.entity';
import { ArtworkTag } from '../tags/entities/artwork-tag.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';
import { ArtworkImage } from './entities/artwork-image.entity';
import { ArtworkReservation } from './entities/artwork-reservation.entity';
import { Artwork } from './entities/artwork.entity';

/** Đăng ký mọi entity mà service dùng qua EntityManager (autoLoadEntities chỉ nạp entity có ở forFeature). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Artwork,
      ArtworkImage,
      ArtworkReservation,
      ArtworkTag,
      Tag,
      ArtworkFolder,
      SellerSummary,
    ]),
  ],
  controllers: [ArtworksController],
  providers: [ArtworksService],
  exports: [ArtworksService],
})
export class ArtworksModule {}
