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
import { QnaMetafieldService } from './qna-metafield.service';
import { QnaService } from './qna.service';
import type { Question, QnaSummary } from './interfaces/qna.interface';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';
import { HaravanService } from '../haravan/haravan.service';
import { ReviewService } from '../review/review.service';

const ORGID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Controller('public/qna')
export class PublicQnaController {
  constructor(
    private readonly haravanService: HaravanService,
    private readonly reviewService: ReviewService,
    private readonly metafieldService: QnaMetafieldService,
    private readonly qnaService: QnaService,
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

  private async assertQnaEnabled(token: string): Promise<void> {
    const config = await this.reviewService.getWidgetConfig(token);
    if (!config.allowQnA) {
      throw new ForbiddenException('QnA is disabled');
    }
  }

  @Get(':productId')
  async getQuestions(
    @Param('productId', NumericIdPipe) productId: string,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const config = await this.reviewService.getWidgetConfig(token);
    if (!config.allowQnA) return { data: [] };
    const all = await this.metafieldService.loadQuestions(token, productId);
    return { data: all.filter((q) => q.status === 'approved') };
  }

  @Get(':productId/summary')
  async getSummary(
    @Param('productId', NumericIdPipe) productId: string,
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);
    const token = await this.getToken(orgid);
    const config = await this.reviewService.getWidgetConfig(token);
    if (!config.allowQnA) {
      return { data: { total: 0, answered: 0, unanswered: 0 } };
    }
    const summary = await this.metafieldService.loadSummary(token, productId);
    return {
      data: (summary as QnaSummary) || { total: 0, answered: 0, unanswered: 0 },
    };
  }

  @Post(':productId')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submitQuestion(
    @Param('productId', NumericIdPipe) productId: string,
    @Body() body: { author: string; question: string; email?: string },
    @Headers('x-orgid') orgidHeader?: string,
  ) {
    const orgid = this.extractOrgid(orgidHeader);

    if (!body.author || typeof body.author !== 'string' || !body.author.trim()) {
      throw new BadRequestException('Author is required');
    }
    if (body.author.trim().length < 2) {
      throw new BadRequestException('Author must be at least 2 characters');
    }
    if (body.author.trim().length > 100) {
      throw new BadRequestException('Author must be at most 100 characters');
    }
    if (!body.question || typeof body.question !== 'string' || !body.question.trim()) {
      throw new BadRequestException('Question is required');
    }
    if (body.question.trim().length < 5) {
      throw new BadRequestException('Question must be at least 5 characters');
    }
    if (body.question.trim().length > 1000) {
      throw new BadRequestException('Question must be at most 1000 characters');
    }
    if (body.email !== undefined && typeof body.email !== 'string') {
      throw new BadRequestException('Email must be a string');
    }

    const email = body.email?.trim();
    if (email && !EMAIL_RE.test(email)) {
      throw new BadRequestException('Email is invalid');
    }
    if (email && email.length > 200) {
      throw new BadRequestException('Email must be at most 200 characters');
    }

    const token = await this.getToken(orgid);
    await this.assertQnaEnabled(token);
    const result = await this.qnaService.addQuestion(token, orgid, productId, {
      author: body.author.trim().slice(0, 100),
      question: body.question.trim().slice(0, 1000),
      email: email?.slice(0, 200),
    });

    return { data: result };
  }
}
