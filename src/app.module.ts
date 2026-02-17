import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './redis/redis.module';
import { HaravanModule } from './haravan/haravan.module';
import { MetafieldModule } from './metafield/metafield.module';
import { TemplateModule } from './template/template.module';
import { ResourceModule } from './resource/resource.module';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule,
    HaravanModule,
    MetafieldModule,
    TemplateModule,
    ResourceModule,
    ShopModule,
  ],
})
export class AppModule {}
