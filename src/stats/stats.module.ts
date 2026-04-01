import { Module } from '@nestjs/common';
import { HaravanModule } from '../haravan/haravan.module';
import { StatsService } from './stats.service';

@Module({
  imports: [HaravanModule],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
