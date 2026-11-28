import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtworkSummaryConsumer } from './artwork-summary.consumer';
import { ArtworkSummary } from './artwork-summary.entity';
import { UserSummaryConsumer } from './user-summary.consumer';
import { UserSummary } from './user-summary.entity';

/** Projection người dùng + tác phẩm. Module khác import để đọc UserSummary / ArtworkSummary. */
@Module({
  imports: [TypeOrmModule.forFeature([UserSummary, ArtworkSummary])],
  providers: [UserSummaryConsumer, ArtworkSummaryConsumer],
  exports: [TypeOrmModule, UserSummaryConsumer, ArtworkSummaryConsumer],
})
export class SummariesModule {}
