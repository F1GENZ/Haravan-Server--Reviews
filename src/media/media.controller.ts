import {
  Controller,
  Post,
  UseGuards,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { MediaService } from './media.service';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

@Controller('media')
@UseGuards(ShopAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 52428800 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('productId') productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.orgid) throw new BadRequestException('Missing auth');
    if (!productId) throw new BadRequestException('Missing productId');
    if (!file) throw new BadRequestException('Missing file');

    const result = await this.mediaService.uploadFile(
      req.orgid,
      productId,
      file.originalname,
      file.mimetype,
      file.buffer,
    );

    return { data: { url: result.cdnUrl, type: result.type } };
  }
}
