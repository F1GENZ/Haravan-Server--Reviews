import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { HaravanModule } from '../haravan/haravan.module';

@Module({
  imports: [HaravanModule],
  controllers: [DebugController],
})
export class DebugModule {}
