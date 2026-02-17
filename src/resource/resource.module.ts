import { Module } from '@nestjs/common';
import { ResourceController } from './resource.controller';
import { HaravanModule } from '../haravan/haravan.module';

@Module({
  imports: [HaravanModule],
  controllers: [ResourceController],
})
export class ResourceModule {}
