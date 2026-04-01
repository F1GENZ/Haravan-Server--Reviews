import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { HaravanModule } from '../haravan/haravan.module';
import { ReviewModule } from '../review/review.module';
import { MediaController } from './media.controller';
import { PublicMediaController } from './public-media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [
    HaravanModule,
    ReviewModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [MediaController, PublicMediaController],
  providers: [MediaService],
})
export class MediaModule {}
