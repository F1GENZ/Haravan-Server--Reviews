import {
  Body,
  Controller,
  Post,
  Headers,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MediaService } from './media.service';
import { HaravanService } from '../haravan/haravan.service';
import { ReviewService } from '../review/review.service';
import { RedisService } from '../redis/redis.service';
import { PresignDto } from './dto/presign.dto';
import type { WidgetConfig } from '../review/interfaces/widget-config.interface';

const ORGID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

@Controller('public/media')
export class PublicMediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly haravanService: HaravanService,
    private readonly reviewService: ReviewService,
    private readonly redis: RedisService,
  ) {}

  private extractOrgid(header?: string): string {
    const orgid = header?.trim();
    if (!orgid) throw new BadRequestException('Missing x-orgid header');
    if (!ORGID_REGEX.test(orgid)) throw new BadRequestException('Invalid orgid');
    return orgid;
  }

  private async getWidgetConfig(
    orgid: string,
    token: string,
  ): Promise<WidgetConfig> {
    const cacheKey = `widget_config:${orgid}`;
    const cached = await this.redis.get<WidgetConfig>(cacheKey);
    if (cached) return cached;

    const config = await this.reviewService.getWidgetConfig(token);
    await this.redis.set(cacheKey, config, 600);
    return config;
  }

  @Post('ticket')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async createTicket(
    @Body() body: PresignDto,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.haravanService.resolveAccessToken(orgid);
    const config = await this.getWidgetConfig(orgid, token);
    const productId = this.mediaService.validateProductId(body.productId);
    const mediaType = this.mediaService.validateUploadInput(
      body.contentType,
      body.fileSize,
    );

    if (mediaType === 'image' && !config.allowImage) {
      throw new ForbiddenException('Image upload is disabled');
    }
    if (mediaType === 'video' && !config.allowVideo) {
      throw new ForbiddenException('Video upload is disabled');
    }

    const { ticket, expiresAt } = this.mediaService.createUploadTicket({
      orgid,
      productId,
      filename: body.filename,
      contentType: body.contentType,
      fileSize: body.fileSize,
    });

    return { data: { ticket, expiresAt } };
  }

  @Post('upload')
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 52428800 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('productId') productId: string,
    @Query('ticket') ticket: string,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);

    if (!productId) throw new BadRequestException('Missing productId');
    if (!file) throw new BadRequestException('Missing file');
    if (!ticket) throw new BadRequestException('Missing upload ticket');

    const safeProductId = this.mediaService.validateProductId(productId);
    this.mediaService.verifyUploadTicket(ticket, {
      orgid,
      productId: safeProductId,
      filename: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size,
    });

    const result = await this.mediaService.uploadFile(
      orgid,
      safeProductId,
      file.originalname,
      file.mimetype,
      file.buffer,
    );

    return { data: { url: result.cdnUrl, type: result.type } };
  }
}
