import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { ReviewService } from './review.service';
import { ReviewMetafieldService } from './review-metafield.service';
import type { Review, RatingSummary } from './interfaces/review.interface';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';
import { HaravanService } from '../haravan/haravan.service';
import type { WidgetConfig } from './interfaces/widget-config.interface';

const ORGID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mask email for public display: "john***@gmail.com" */
function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf('@');
  if (at < 0) return '***';
  const local = email.slice(0, at);
  const show = Math.max(2, Math.ceil(local.length / 3));
  return local.slice(0, show) + '***@' + email.slice(at + 1);
}

/** Mask phone for public display: "091***78" */
function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  if (phone.length <= 5) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}

/** Strip PII from reviews for public consumption */
function sanitizeForPublic(
  reviews: Review[],
  emailDisplay: string,
  phoneDisplay: string,
) {
  return reviews.map((r) => ({
    ...r,
    email:
      emailDisplay === 'hidden'
        ? undefined
        : emailDisplay === 'full'
          ? r.email
          : maskEmail(r.email),
    phone:
      phoneDisplay === 'hidden'
        ? undefined
        : phoneDisplay === 'full'
          ? r.phone
          : maskPhone(r.phone),
  }));
}

@Controller('public/reviews')
export class PublicReviewController {
  constructor(
    private readonly redis: RedisService,
    private readonly haravanService: HaravanService,
    private readonly reviewService: ReviewService,
    private readonly metafieldService: ReviewMetafieldService,
  ) {}

  private async getToken(orgid: string): Promise<string> {
    return this.haravanService.resolveAccessToken(orgid);
  }

  private extractOrgid(header?: string): string {
    const orgid = header?.trim();
    if (!orgid) throw new BadRequestException('Missing x-orgid header');
    if (!ORGID_REGEX.test(orgid))
      throw new BadRequestException('Invalid orgid');
    return orgid;
  }

  private async getWidgetConfigForOrgid(
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

  @Get('config/widget')
  async getWidgetConfig(@Headers('x-orgid') orgidHeader?: string) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const config = await this.getWidgetConfigForOrgid(orgid, token);
    return { data: config };
  }

  @Get(':productId')
  async getReviews(
    @Param('productId', NumericIdPipe) productId: string,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const all = await this.metafieldService.loadReviews(token, productId);
    const approved = all.filter((r) => r.status === 'approved');

    // Load widget config to determine email/phone display mode (safe fallback to mask)
    let emailDisplay = 'mask';
    let phoneDisplay = 'mask';
    try {
      const cfg = await this.getWidgetConfigForOrgid(orgid, token);
      emailDisplay = String(cfg.emailDisplay ?? 'mask');
      phoneDisplay = String(cfg.phoneDisplay ?? 'mask');
    } catch {
      // Fallback to mask on any error — safe default
    }

    return {
      data: sanitizeForPublic(approved, emailDisplay, phoneDisplay),
    };
  }

  @Get(':productId/summary')
  async getSummary(
    @Param('productId', NumericIdPipe) productId: string,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const summary = await this.metafieldService.loadSummary(token, productId);
    return {
      data: (summary as RatingSummary) || {
        avg: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    };
  }

  /** Storefront submit review (no auth guard — uses orgid header to look up token) */
  @Post(':productId')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submitReview(
    @Param('productId', NumericIdPipe) productId: string,
    @Body()
    body: {
      rating: number;
      content: string;
      author: string;
      title?: string;
      email?: string;
      phone?: string;
      media?: { url: string; type: 'image' | 'video' }[];
    },
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const config = await this.getWidgetConfigForOrgid(orgid, token);

    if (config.requireLogin) {
      throw new ForbiddenException('Review submission requires login');
    }

    // Basic validation
    if (
      !body.rating ||
      body.rating < 1 ||
      body.rating > 5 ||
      !Number.isInteger(body.rating)
    ) {
      throw new BadRequestException('Rating must be an integer 1-5');
    }
    if (
      !body.author ||
      typeof body.author !== 'string' ||
      body.author.trim().length === 0
    ) {
      throw new BadRequestException('Author is required');
    }
    if (body.content && typeof body.content !== 'string') {
      throw new BadRequestException('Content must be a string');
    }
    if (body.title !== undefined && typeof body.title !== 'string') {
      throw new BadRequestException('Title must be a string');
    }
    if (body.email !== undefined && typeof body.email !== 'string') {
      throw new BadRequestException('Email must be a string');
    }
    if (body.phone !== undefined && typeof body.phone !== 'string') {
      throw new BadRequestException('Phone must be a string');
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (config.formTitleMode === 'required' && !title) {
      throw new BadRequestException('Title is required');
    }
    if (config.formContentRequired && !content) {
      throw new BadRequestException('Content is required');
    }
    if (config.formEmailMode === 'required' && !email) {
      throw new BadRequestException('Email is required');
    }
    if (email && !EMAIL_RE.test(email)) {
      throw new BadRequestException('Email is invalid');
    }
    if (config.formPhoneMode === 'required' && !phone) {
      throw new BadRequestException('Phone is required');
    }

    // Validate & sanitize media items
    const URL_RE = /^https:\/\//i;
    const inputMedia = Array.isArray(body.media) ? body.media : [];
    const disallowedMedia = inputMedia.some(
      (m) =>
        !!m &&
        ((m.type === 'image' && !config.allowImage) ||
          (m.type === 'video' && !config.allowVideo)),
    );
    if (disallowedMedia) {
      throw new BadRequestException('Submitted media type is not allowed');
    }
    const safeMedia = (Array.isArray(body.media) ? body.media : [])
      .slice(0, 5)
      .filter(
        (m): m is { url: string; type: 'image' | 'video' } =>
          !!m &&
          typeof m.url === 'string' &&
          URL_RE.test(m.url) &&
          m.url.length <= 2000 &&
          ((m.type === 'image' && config.allowImage) ||
            (m.type === 'video' && config.allowVideo)),
      );

    const review = await this.reviewService.addReview(token, orgid, productId, {
      rating: body.rating,
      content: content.slice(0, 2000),
      author: body.author.slice(0, 100),
      title:
        config.formTitleMode === 'hidden' ? undefined : title.slice(0, 100),
      email:
        config.formEmailMode === 'hidden' ? undefined : email.slice(0, 200),
      phone:
        config.formPhoneMode === 'hidden' ? undefined : phone.slice(0, 20),
      media: safeMedia,
      // Public submissions always go through spam detection — never trust caller status
    });

    return { data: review };
  }
}
