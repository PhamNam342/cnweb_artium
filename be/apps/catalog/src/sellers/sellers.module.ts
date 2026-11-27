import { Module } from '@nestjs/common';
import { SellerSummaryConsumer } from './seller-summary.consumer';

@Module({
  providers: [SellerSummaryConsumer],
  exports: [SellerSummaryConsumer],
})
export class SellersModule {}
