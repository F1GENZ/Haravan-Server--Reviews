import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { RedisModule } from '../redis/redis.module';
import { HaravanModule } from '../haravan/haravan.module';

@Module({
  imports: [RedisModule, HaravanModule],
  controllers: [ShopController],
})
export class ShopModule {}
