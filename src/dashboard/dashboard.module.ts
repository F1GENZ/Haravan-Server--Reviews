import { Module } from '@nestjs/common';
import { HaravanModule } from '../haravan/haravan.module';
import { StatsModule } from '../stats/stats.module';
import { ReviewModule } from '../review/review.module';
import { QnaModule } from '../qna/qna.module';
import { RedisModule } from '../redis/redis.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [HaravanModule, StatsModule, ReviewModule, QnaModule, RedisModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
