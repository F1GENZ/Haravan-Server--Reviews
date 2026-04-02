import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateSpamConfigDto } from './dto/update-spam-config.dto';
import { UpdateWidgetConfigDto } from './dto/update-widget-config.dto';
import { ValidationPipe } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

@Controller('reviews')
@UseGuards(ShopAuthGuard)
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly redis: RedisService,
  ) {}

  // Static routes MUST come before :productId param routes
  @Get('config/spam')
  async getSpamConfig(@Req() req: AuthRequest) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const config = await this.reviewService.getSpamConfig(req.token);
    return { data: config };
  }

  @Put('config/spam')
  async updateSpamConfig(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateSpamConfigDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const config = await this.reviewService.updateSpamConfig(req.token, dto);
    return { data: config };
  }

  @Get('config/widget')
  async getWidgetConfig(@Req() req: AuthRequest) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const config = await this.reviewService.getWidgetConfig(req.token);
    return { data: config };
  }

  @Put('config/widget')
  async updateWidgetConfig(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateWidgetConfigDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const config = await this.reviewService.updateWidgetConfig(req.token, dto);
    if (req.orgid) await this.redis.del(`widget_config:${req.orgid}`);
    return { data: config };
  }

  @Get('all')
  async getAllReviews(@Req() req: AuthRequest) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const reviews = await this.reviewService.getAllReviews(req.token, req.orgid);
    return { data: reviews };
  }

  @Get(':productId')
  async getReviews(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const reviews = await this.reviewService.getReviews(
      req.token,
      req.orgid,
      productId,
    );
    return { data: reviews };
  }

  @Get(':productId/summary')
  async getSummary(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const summary = await this.reviewService.getSummary(
      req.token,
      req.orgid,
      productId,
    );
    return { data: summary };
  }

  @Post(':productId')
  async addReview(
    @Param('productId', NumericIdPipe) productId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateReviewDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const review = await this.reviewService.addReview(
      req.token,
      req.orgid,
      productId,
      dto,
    );
    return { data: review };
  }

  @Put(':productId/:reviewId')
  async editReview(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('reviewId') reviewId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateReviewDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const review = await this.reviewService.editReview(
      req.token,
      req.orgid,
      productId,
      reviewId,
      dto,
    );
    if (!review) throw new NotFoundException('Review not found');
    return { data: review };
  }

  @Put(':productId/:reviewId/reply')
  async replyToReview(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('reviewId') reviewId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: ReplyReviewDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const review = await this.reviewService.replyToReview(
      req.token,
      req.orgid,
      productId,
      reviewId,
      dto.reply,
    );
    if (!review) throw new NotFoundException('Review not found');
    return { data: review };
  }

  @Put(':productId/:reviewId/status')
  async updateStatus(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('reviewId') reviewId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateStatusDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const review = await this.reviewService.updateReviewStatus(
      req.token,
      req.orgid,
      productId,
      reviewId,
      dto.status,
    );
    if (!review) throw new NotFoundException('Review not found');
    return { data: review };
  }

  @Delete(':productId/:reviewId')
  async deleteReview(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('reviewId') reviewId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const deleted = await this.reviewService.deleteReview(
      req.token,
      req.orgid,
      productId,
      reviewId,
    );
    if (!deleted) throw new NotFoundException('Review not found');
    return { data: { success: true } };
  }
}
