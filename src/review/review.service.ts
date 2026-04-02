import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { HaravanAPIService } from '../haravan/haravan.api';
import { ReviewMetafieldService } from './review-metafield.service';
import { StatsService } from '../stats/stats.service';
import type {
  Review,
  RatingSummary,
  ReviewStatus,
} from './interfaces/review.interface';
import type { SpamConfig } from './interfaces/spam-config.interface';
import { DEFAULT_SPAM_CONFIG } from './interfaces/spam-config.interface';
import type { WidgetConfig } from './interfaces/widget-config.interface';
import { DEFAULT_WIDGET_CONFIG } from './interfaces/widget-config.interface';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import { randomBytes } from 'crypto';
import { sanitizeText } from '../common/utils/sanitize';

const LOCK_TTL = 30; // 30 seconds
const LOCK_MAX_RETRIES = 4;
const LOCK_BASE_DELAY = 500; // ms

const generateId = (): string => randomBytes(12).toString('base64url');

/** Spam detection using configurable rules */
function detectSpamStatus(
  content: string,
  author: string,
  existingReviews: Review[],
  cfg: SpamConfig,
): ReviewStatus {
  // If detection disabled, use autoApprove setting
  if (!cfg.enabled) return cfg.autoApprove ? 'approved' : 'pending';

  const lower = content.toLowerCase();

  // 1. URL / link spam
  const urlCount = (lower.match(/https?:\/\//g) || []).length;
  if (urlCount >= cfg.maxUrls) return 'spam';

  // 2. Repeated characters (e.g. "aaaaaaa", "!!!!!!")
  if (cfg.blockRepeatedChars && /(.)\1{9,}/.test(content)) return 'spam';

  // 3. Duplicate content from same author within this product
  if (cfg.blockDuplicate) {
    const hasDuplicate = existingReviews.some(
      (r) =>
        r.author.toLowerCase() === author.toLowerCase() &&
        r.content.toLowerCase() === lower,
    );
    if (hasDuplicate) return 'spam';
  }

  // 4. Same author posted too many reviews on this product
  const sameAuthorCount = existingReviews.filter(
    (r) => r.author.toLowerCase() === author.toLowerCase(),
  ).length;
  if (sameAuthorCount >= cfg.maxReviewsPerAuthor) return 'spam';

  // 5. Blocked words
  if (cfg.blockedWords.length > 0) {
    const found = cfg.blockedWords.some((w) => lower.includes(w.toLowerCase()));
    if (found) return 'spam';
  }

  // 6. Very short content → pending (or approved if autoApprove + long enough)
  if (content.length < cfg.minContentLength) return 'pending';

  return cfg.autoApprove ? 'approved' : 'pending';
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly haravanApi: HaravanAPIService,
    private readonly metafieldService: ReviewMetafieldService,
    private readonly statsService: StatsService,
  ) {}

  private lockKey(orgid: string, productId: string): string {
    return `lock:reviews:${orgid}:${productId}`;
  }

  private static readonly CONFIG_NAMESPACE = 'reviews';

  /** Read a shop-level config metafield; returns null if not set */
  private async readConfigMetafield<T>(
    token: string,
    key: string,
  ): Promise<T | null> {
    try {
      const metafields = await this.haravanApi.getMetafields(
        token,
        'shop',
        ReviewService.CONFIG_NAMESPACE,
        '',
      );
      const found = metafields.find((m) => m.key === key);
      if (!found?.value) return null;
      const raw =
        typeof found.value === 'string'
          ? found.value
          : JSON.stringify(found.value);
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Upsert a shop-level config metafield (create or update) */
  private async writeConfigMetafield(
    token: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const jsonStr = JSON.stringify(value);
    try {
      const metafields = await this.haravanApi.getMetafields(
        token,
        'shop',
        ReviewService.CONFIG_NAMESPACE,
        '',
      );
      const existing = metafields.find((m) => m.key === key);
      if (existing?.id) {
        await this.haravanApi.updateMetafield(token, {
          metafieldid: String(existing.id),
          value: jsonStr,
          value_type: 'json',
        });
      } else {
        await this.haravanApi.createMetafield(token, {
          type: 'shop',
          objectid: '',
          namespace: ReviewService.CONFIG_NAMESPACE,
          key,
          value: jsonStr,
          value_type: 'json',
        });
      }
    } catch (err) {
      this.logger.error(
        `writeConfigMetafield [${key}] failed: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }

  async getWidgetConfig(token: string): Promise<WidgetConfig> {
    const saved = await this.readConfigMetafield<Partial<WidgetConfig>>(
      token,
      'widget_config',
    );
    return saved
      ? { ...DEFAULT_WIDGET_CONFIG, ...saved }
      : { ...DEFAULT_WIDGET_CONFIG };
  }

  async updateWidgetConfig(
    token: string,
    partial: Partial<WidgetConfig>,
  ): Promise<WidgetConfig> {
    const current = await this.getWidgetConfig(token);
    const merged = { ...current, ...partial };
    await this.writeConfigMetafield(token, 'widget_config', merged);
    return merged;
  }

  async getSpamConfig(token: string): Promise<SpamConfig> {
    const saved = await this.readConfigMetafield<Partial<SpamConfig>>(
      token,
      'spam_config',
    );
    return saved
      ? { ...DEFAULT_SPAM_CONFIG, ...saved }
      : { ...DEFAULT_SPAM_CONFIG };
  }

  async updateSpamConfig(
    token: string,
    partial: Partial<SpamConfig>,
  ): Promise<SpamConfig> {
    const current = await this.getSpamConfig(token);
    const merged = { ...current, ...partial };
    await this.writeConfigMetafield(token, 'spam_config', merged);
    return merged;
  }

  async getReviews(
    token: string,
    orgid: string,
    productId: string,
  ): Promise<Review[]> {
    return this.metafieldService.loadReviews(token, productId);
  }

  /**
   * Load all reviews across all products that have reviews.
   * Uses stats to get product IDs, then loads in parallel (up to 6 concurrent).
   * Injects productId into each review for client-side operations.
   */
  async getAllReviews(
    token: string,
    orgid: string,
  ): Promise<(Review & { productId: string })[]> {
    const stats = await this.statsService.getDecodedStats(token, orgid);
    const productIds = stats.products
      .filter((p) => p.reviewCount > 0)
      .map((p) => p.productId);

    const CONCURRENCY = 6;
    const results: (Review & { productId: string })[] = [];

    for (let i = 0; i < productIds.length; i += CONCURRENCY) {
      const chunk = productIds.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (productId) => {
          try {
            const reviews = await this.metafieldService.loadReviews(token, productId);
            return reviews.map((r) => ({ ...r, productId }));
          } catch {
            return [];
          }
        }),
      );
      results.push(...chunkResults.flat());
    }

    return results.sort((a, b) => b.created_at - a.created_at);
  }

  async getSummary(
    token: string,
    orgid: string,
    productId: string,
  ): Promise<RatingSummary> {
    const summary = await this.metafieldService.loadSummary(token, productId);
    return (
      summary || {
        avg: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    );
  }

  async addReview(
    token: string,
    orgid: string,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    await this.acquireLock(orgid, productId);
    try {
      const { reviews, metafields } =
        await this.metafieldService.loadReviewsWithMeta(token, productId);

      const cleanContent = sanitizeText(dto.content);
      const cleanAuthor = sanitizeText(dto.author);
      const spamCfg = await this.getSpamConfig(token);
      const status = detectSpamStatus(
        cleanContent,
        cleanAuthor,
        reviews,
        spamCfg,
      );

      const review: Review = {
        id: generateId(),
        rating: dto.rating,
        content: cleanContent,
        author: cleanAuthor,
        ...(dto.email ? { email: dto.email.trim() } : {}),
        ...(dto.phone ? { phone: dto.phone.trim() } : {}),
        ...(dto.title ? { title: sanitizeText(dto.title) } : {}),
        media: dto.media || [],
        status: dto.status ?? status,
        ...(dto.verified !== undefined ? { verified: dto.verified } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        created_at: dto.created_at ?? Date.now(),
        updated_at: Date.now(),
      };

      reviews.unshift(review); // newest first
      const summary = this.metafieldService.calculateSummary(reviews);
      await this.metafieldService.writeReviews(
        token,
        productId,
        reviews,
        summary,
        metafields,
      );

      // Fire-and-forget stats update
      this.statsService
        .updateProductReviewStats(token, orgid, productId, summary, {
          id: review.id,
          rating: review.rating,
          author: review.author,
          content: review.content,
          created_at: review.created_at,
        })
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return review;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async editReview(
    token: string,
    orgid: string,
    productId: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<Review | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { reviews, metafields } =
        await this.metafieldService.loadReviewsWithMeta(token, productId);
      const index = reviews.findIndex((r) => r.id === reviewId);
      if (index === -1) return null;

      const review = reviews[index];
      if (dto.rating !== undefined) review.rating = dto.rating;
      if (dto.content !== undefined) review.content = sanitizeText(dto.content);
      if (dto.author !== undefined) review.author = sanitizeText(dto.author);
      if (dto.title !== undefined)
        review.title = dto.title ? sanitizeText(dto.title) : undefined;
      if (dto.email !== undefined)
        review.email = dto.email?.trim() || undefined;
      if (dto.phone !== undefined)
        review.phone = dto.phone?.trim() || undefined;
      if (dto.verified !== undefined) review.verified = dto.verified;
      if (dto.pinned !== undefined) review.pinned = dto.pinned;
      if (dto.status !== undefined)
        review.status = dto.status as Review['status'];
      if (dto.created_at !== undefined) review.created_at = dto.created_at;
      if (dto.media !== undefined) review.media = dto.media;
      review.updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(reviews);
      await this.metafieldService.writeReviews(
        token,
        productId,
        reviews,
        summary,
        metafields,
      );

      this.statsService
        .updateProductReviewStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return review;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async deleteReview(
    token: string,
    orgid: string,
    productId: string,
    reviewId: string,
  ): Promise<boolean> {
    await this.acquireLock(orgid, productId);
    try {
      const { reviews, metafields } =
        await this.metafieldService.loadReviewsWithMeta(token, productId);
      const filtered = reviews.filter((r) => r.id !== reviewId);
      if (filtered.length === reviews.length) return false;

      const summary = this.metafieldService.calculateSummary(filtered);
      await this.metafieldService.writeReviews(
        token,
        productId,
        filtered,
        summary,
        metafields,
      );

      this.statsService
        .updateProductReviewStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));
      this.statsService
        .removeRecentReview(token, orgid, reviewId)
        .catch((e) =>
          this.logger.warn(`Stats recent remove failed: ${e?.message}`),
        );

      return true;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async replyToReview(
    token: string,
    orgid: string,
    productId: string,
    reviewId: string,
    replyText: string,
  ): Promise<Review | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { reviews, metafields } =
        await this.metafieldService.loadReviewsWithMeta(token, productId);
      const index = reviews.findIndex((r) => r.id === reviewId);
      if (index === -1) return null;

      reviews[index].reply = sanitizeText(replyText);
      reviews[index].replied_at = Date.now();
      reviews[index].updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(reviews);
      await this.metafieldService.writeReviews(
        token,
        productId,
        reviews,
        summary,
        metafields,
      );

      return reviews[index];
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async updateReviewStatus(
    token: string,
    orgid: string,
    productId: string,
    reviewId: string,
    status: ReviewStatus,
  ): Promise<Review | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { reviews, metafields } =
        await this.metafieldService.loadReviewsWithMeta(token, productId);
      const index = reviews.findIndex((r) => r.id === reviewId);
      if (index === -1) return null;

      reviews[index].status = status;
      reviews[index].updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(reviews);
      await this.metafieldService.writeReviews(
        token,
        productId,
        reviews,
        summary,
        metafields,
      );

      return reviews[index];
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  private async acquireLock(orgid: string, productId: string): Promise<void> {
    const key = this.lockKey(orgid, productId);
    for (let attempt = 0; attempt <= LOCK_MAX_RETRIES; attempt++) {
      const acquired = await this.redis.setNx(key, '1', LOCK_TTL);
      if (acquired) return;
      if (attempt < LOCK_MAX_RETRIES) {
        const delay = LOCK_BASE_DELAY * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`Write lock busy for product ${productId}`);
  }

  private async releaseLock(orgid: string, productId: string): Promise<void> {
    await this.redis.del(this.lockKey(orgid, productId));
  }
}
