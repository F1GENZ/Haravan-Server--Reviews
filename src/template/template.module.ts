import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { HaravanModule } from '../haravan/haravan.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [HaravanModule, RedisModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
