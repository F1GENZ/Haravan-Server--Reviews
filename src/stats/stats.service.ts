import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { HaravanAPIService } from '../haravan/haravan.api';

const MF_NAMESPACE = 'f1genz';
const MF_KEY = 'stats';
const LOCK_TTL = 30;

/* ── Full-name types (readable keys in metafield storage) ── */

export interface ProductStatEntry {
  reviewCount: number;
  reviewAvg: number;
  reviewDistribution: Record<string, number>;
  qnaTotal: number;
  qnaAnswered: number;
}

export interface RecentReviewEntry {
  id: string;
  rating: number;
  author: string;
  content: string; // max 200 chars
  created_at: number;
  productId: string;
}

export interface ShopStats {
  totalReviews: number;
  totalQuestions: number;
  totalAnswered: number;
  globalAvg: number;
  globalDistribution: Record<string, number>;
  products: Record<string, ProductStatEntry>;
  recentReviews: RecentReviewEntry[];
  lastUpdated: number;
}

/* ── Decoded types for API consumers (now identical to storage) ── */

export type DecodedProductStats = {
  productId: string;
  reviewCount: number;
  reviewAvg: number;
  reviewDist: Record<number, number>;
  qnaTotal: number;
  qnaAnswered: number;
};

export type DecodedShopStats = {
  totalReviews: number;
  totalQuestions: number;
  totalAnswered: number;
  globalAvg: number;
  globalDist: Record<number, number>;
  products: DecodedProductStats[];
  recentReviews: Array<{
    id: string;
    rating: number;
    author: string;
    content: string;
    created_at: number;
    productId: string;
  }>;
  lastUpdated: number;
};

const emptyStats = (): ShopStats => ({
  totalReviews: 0,
  totalQuestions: 0,
  totalAnswered: 0,
  globalAvg: 0,
  globalDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  products: {},
  recentReviews: [],
  lastUpdated: Date.now(),
});

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly haravanAPI: HaravanAPIService,
  ) {}

  private lockKey(orgid: string): string {
    return `lock:stats:${orgid}`;
  }

  /* ── Read ── */

  async getStats(token: string, orgid: string): Promise<ShopStats> {
    try {
      const metafields = await this.haravanAPI.getMetafields(
        token,
        'shop',
        MF_NAMESPACE,
        '',
      );
      // Filter client-side (Haravan namespace filter may be broken)
      const statsMf = metafields
        .filter((m) => m.namespace === MF_NAMESPACE)
        .find((m) => m.key === MF_KEY);

      if (statsMf?.value) {
        const stats: ShopStats =
          typeof statsMf.value === 'string'
            ? JSON.parse(statsMf.value)
            : (statsMf.value as ShopStats);
        return stats;
      }
    } catch (err) {
      this.logger.warn(`Failed to read shop stats: ${(err as Error)?.message}`);
    }

    return emptyStats();
  }

  /** Decoded stats for API responses */
  async getDecodedStats(
    token: string,
    orgid: string,
  ): Promise<DecodedShopStats> {
    const s = await this.getStats(token, orgid);
    return this.decode(s);
  }

  /* ── Write (called after review mutations) ── */

  async updateProductReviewStats(
    token: string,
    orgid: string,
    productId: string,
    reviewSummary: {
      count: number;
      avg: number;
      distribution: Record<number | string, number>;
    },
    latestReview?: {
      id: string;
      rating: number;
      author: string;
      content: string;
      created_at: number;
    },
  ): Promise<void> {
    try {
      await this.acquireLock(orgid);
      const stats = await this.getStats(token, orgid);

      const entry: ProductStatEntry = stats.products[productId] || {
        reviewCount: 0,
        reviewAvg: 0,
        reviewDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        qnaTotal: 0,
        qnaAnswered: 0,
      };
      entry.reviewCount = reviewSummary.count;
      entry.reviewAvg = reviewSummary.avg;
      entry.reviewDistribution = {};
      for (let s = 1; s <= 5; s++) {
        const val =
          reviewSummary.distribution[s] ||
          reviewSummary.distribution[String(s)] ||
          0;
        if (val > 0) entry.reviewDistribution[String(s)] = val;
      }

      if (entry.reviewCount === 0 && entry.qnaTotal === 0) {
        delete stats.products[productId];
      } else {
        stats.products[productId] = entry;
      }

      // Update recent reviews
      if (latestReview) {
        stats.recentReviews = [
          {
            id: latestReview.id,
            rating: latestReview.rating,
            author: latestReview.author,
            content: latestReview.content.slice(0, 200),
            created_at: latestReview.created_at,
            productId,
          },
          ...stats.recentReviews.filter((r) => r.id !== latestReview.id),
        ].slice(0, 10);
      }

      this.recalcGlobals(stats);
      await this.saveStats(token, orgid, stats);
    } catch (err) {
      this.logger.error(
        `Failed to update review stats: ${(err as Error)?.message}`,
      );
    } finally {
      await this.releaseLock(orgid);
    }
  }

  async updateProductQnaStats(
    token: string,
    orgid: string,
    productId: string,
    qnaSummary: { total: number; answered: number },
  ): Promise<void> {
    try {
      await this.acquireLock(orgid);
      const stats = await this.getStats(token, orgid);

      const entry: ProductStatEntry = stats.products[productId] || {
        reviewCount: 0,
        reviewAvg: 0,
        reviewDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        qnaTotal: 0,
        qnaAnswered: 0,
      };
      entry.qnaTotal = qnaSummary.total;
      entry.qnaAnswered = qnaSummary.answered;

      if (entry.reviewCount === 0 && entry.qnaTotal === 0) {
        delete stats.products[productId];
      } else {
        stats.products[productId] = entry;
      }

      this.recalcGlobals(stats);
      await this.saveStats(token, orgid, stats);
    } catch (err) {
      this.logger.error(
        `Failed to update qna stats: ${(err as Error)?.message}`,
      );
    } finally {
      await this.releaseLock(orgid);
    }
  }

  /** Remove a review from the recent reviews list */
  async removeRecentReview(
    token: string,
    orgid: string,
    reviewId: string,
  ): Promise<void> {
    try {
      await this.acquireLock(orgid);
      const stats = await this.getStats(token, orgid);
      const before = stats.recentReviews.length;
      stats.recentReviews = stats.recentReviews.filter(
        (r) => r.id !== reviewId,
      );
      if (stats.recentReviews.length !== before) {
        await this.saveStats(token, orgid, stats);
      }
    } catch (err) {
      this.logger.error(
        `Failed to remove recent review: ${(err as Error)?.message}`,
      );
    } finally {
      await this.releaseLock(orgid);
    }
  }

  /**
   * Full rebuild from pre-computed product summaries.
   * Called by DashboardService.rebuildStats().
   */
  async rebuildStats(
    token: string,
    orgid: string,
    productSummaries: Array<{
      productId: string;
      reviewSummary: {
        count: number;
        avg: number;
        distribution: Record<number | string, number>;
      };
      qnaSummary: { total: number; answered: number };
      recentReviews?: Array<{
        id: string;
        rating: number;
        author: string;
        content: string;
        created_at: number;
      }>;
    }>,
  ): Promise<ShopStats> {
    const stats = emptyStats();

    for (const ps of productSummaries) {
      const entry: ProductStatEntry = {
        reviewCount: ps.reviewSummary.count,
        reviewAvg: ps.reviewSummary.avg,
        reviewDistribution: {},
        qnaTotal: ps.qnaSummary.total,
        qnaAnswered: ps.qnaSummary.answered,
      };
      for (let s = 1; s <= 5; s++) {
        const val =
          ps.reviewSummary.distribution[s] ||
          ps.reviewSummary.distribution[String(s)] ||
          0;
        if (val > 0) entry.reviewDistribution[String(s)] = val;
      }

      if (entry.reviewCount > 0 || entry.qnaTotal > 0) {
        stats.products[ps.productId] = entry;
      }

      // Collect recent reviews
      if (ps.recentReviews) {
        for (const r of ps.recentReviews) {
          stats.recentReviews.push({
            id: r.id,
            rating: r.rating,
            author: r.author,
            content: r.content.slice(0, 200),
            created_at: r.created_at,
            productId: ps.productId,
          });
        }
      }
    }

    // Sort and trim recent reviews
    stats.recentReviews.sort((a, b) => b.created_at - a.created_at);
    stats.recentReviews = stats.recentReviews.slice(0, 10);

    this.recalcGlobals(stats);
    await this.saveStats(token, orgid, stats);
    return stats;
  }

  /* ── Internals ── */

  private recalcGlobals(stats: ShopStats): void {
    let totalReviews = 0;
    let totalQuestions = 0;
    let totalAnswered = 0;
    const gd: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };

    for (const e of Object.values(stats.products)) {
      totalReviews += e.reviewCount;
      totalQuestions += e.qnaTotal;
      totalAnswered += e.qnaAnswered;
      for (let s = 1; s <= 5; s++) {
        gd[String(s)] += e.reviewDistribution?.[String(s)] || 0;
      }
    }

    const globalAvg =
      totalReviews > 0
        ? Math.round(
            ([1, 2, 3, 4, 5].reduce(
              (sum, s) => sum + s * (gd[String(s)] || 0),
              0,
            ) /
              totalReviews) *
              10,
          ) / 10
        : 0;

    stats.totalReviews = totalReviews;
    stats.totalQuestions = totalQuestions;
    stats.totalAnswered = totalAnswered;
    stats.globalAvg = globalAvg;
    stats.globalDistribution = gd;
    stats.lastUpdated = Date.now();
  }

  private async saveStats(
    token: string,
    orgid: string,
    stats: ShopStats,
  ): Promise<void> {
    const value = JSON.stringify(stats);

    const metafields = await this.haravanAPI.getMetafields(
      token,
      'shop',
      MF_NAMESPACE,
      '',
    );
    const existing = metafields
      .filter((m) => m.namespace === MF_NAMESPACE)
      .find((m) => m.key === MF_KEY);

    if (existing?.id) {
      await this.haravanAPI.updateMetafield(token, {
        metafieldid: String(existing.id),
        value,
        value_type: 'json',
      });
    } else {
      await this.haravanAPI.createMetafield(token, {
        type: 'shop',
        objectid: '',
        namespace: MF_NAMESPACE,
        key: MF_KEY,
        value,
        value_type: 'json',
      });
    }
  }

  private decode(s: ShopStats): DecodedShopStats {
    const products: DecodedProductStats[] = Object.entries(s.products).map(
      ([pid, e]) => ({
        productId: pid,
        reviewCount: e.reviewCount,
        reviewAvg: e.reviewAvg,
        reviewDist: {
          1: e.reviewDistribution?.['1'] || 0,
          2: e.reviewDistribution?.['2'] || 0,
          3: e.reviewDistribution?.['3'] || 0,
          4: e.reviewDistribution?.['4'] || 0,
          5: e.reviewDistribution?.['5'] || 0,
        },
        qnaTotal: e.qnaTotal,
        qnaAnswered: e.qnaAnswered,
      }),
    );

    return {
      totalReviews: s.totalReviews,
      totalQuestions: s.totalQuestions,
      totalAnswered: s.totalAnswered,
      globalAvg: s.globalAvg,
      globalDist: {
        1: s.globalDistribution?.['1'] || 0,
        2: s.globalDistribution?.['2'] || 0,
        3: s.globalDistribution?.['3'] || 0,
        4: s.globalDistribution?.['4'] || 0,
        5: s.globalDistribution?.['5'] || 0,
      },
      products,
      recentReviews: s.recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        author: r.author,
        content: r.content,
        created_at: r.created_at,
        productId: r.productId,
      })),
      lastUpdated: s.lastUpdated,
    };
  }

  private async acquireLock(orgid: string): Promise<void> {
    const key = this.lockKey(orgid);
    for (let attempt = 0; attempt < 5; attempt++) {
      const acquired = await this.redis.setNx(key, '1', LOCK_TTL);
      if (acquired) return;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
    throw new Error(`Stats lock busy for orgid ${orgid} after 5 retries`);
  }

  private async releaseLock(orgid: string): Promise<void> {
    await this.redis.del(this.lockKey(orgid));
  }
}
