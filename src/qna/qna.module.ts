import { Module } from '@nestjs/common';
import { HaravanModule } from '../haravan/haravan.module';
import { ReviewModule } from '../review/review.module';
import { StatsModule } from '../stats/stats.module';
import { QnaController } from './qna.controller';
import { PublicQnaController } from './public-qna.controller';
import { QnaService } from './qna.service';
import { QnaMetafieldService } from './qna-metafield.service';

@Module({
  imports: [HaravanModule, ReviewModule, StatsModule],
  controllers: [QnaController, PublicQnaController],
  providers: [QnaService, QnaMetafieldService],
  exports: [QnaService],
})
export class QnaModule {}
