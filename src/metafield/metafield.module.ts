import { Module } from '@nestjs/common';
import { MetafieldController } from './metafield.controller';
import { MetafieldService } from './metafield.service';
import { HaravanModule } from '../haravan/haravan.module';

@Module({
  imports: [HaravanModule],
  controllers: [MetafieldController],
  providers: [MetafieldService],
  exports: [MetafieldService],
})
export class MetafieldModule {}
