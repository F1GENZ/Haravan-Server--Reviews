import { Module } from '@nestjs/common';
import { HaravanModule } from '../haravan/haravan.module';
import { StatsModule } from '../stats/stats.module';
import { ReviewController } from './review.controller';
import { PublicReviewController } from './public-review.controller';
import { ReviewService } from './review.service';
import { ReviewMetafieldService } from './review-metafield.service';

@Module({
  imports: [HaravanModule, StatsModule],
  controllers: [ReviewController, PublicReviewController],
  providers: [ReviewService, ReviewMetafieldService],
  exports: [ReviewService, ReviewMetafieldService],
})
export class ReviewModule {}
