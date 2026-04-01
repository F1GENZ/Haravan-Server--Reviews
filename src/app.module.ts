import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from './redis/redis.module';
import { HaravanModule } from './haravan/haravan.module';
import { ReviewModule } from './review/review.module';
import { QnaModule } from './qna/qna.module';
import { MediaModule } from './media/media.module';
import { ProductModule } from './product/product.module';
import { StatsModule } from './stats/stats.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DebugModule } from './debug/debug.module';
import { StorefrontModule } from './storefront/storefront.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    RedisModule,
    HaravanModule,
    StatsModule,
    ReviewModule,
    QnaModule,
    MediaModule,
    ProductModule,
    DashboardModule,
    DebugModule,
    StorefrontModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
