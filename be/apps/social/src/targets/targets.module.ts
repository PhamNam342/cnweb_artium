import { Module } from '@nestjs/common';
import { SummariesModule } from '../summaries/summaries.module';
import { ArtworkTargetResolver } from './artwork-target.resolver';
import { TargetRegistry } from './target-registry';

/**
 * Registry đối tượng của like / bình luận. Module khác import TargetsModule rồi
 * đăng ký resolver của mình trong onModuleInit (xem ArtworkTargetResolver).
 */
@Module({
  imports: [SummariesModule],
  providers: [TargetRegistry, ArtworkTargetResolver],
  exports: [TargetRegistry],
})
export class TargetsModule {}
