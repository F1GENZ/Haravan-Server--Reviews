import { Injectable, Logger } from '@nestjs/common';
import { StatsService } from '../stats/stats.service';
import { ReviewService } from '../review/review.service';
import { ReviewMetafieldService } from '../review/review-metafield.service';
import { QnaService } from '../qna/qna.service';
import { QnaMetafieldService } from '../qna/qna-metafield.service';
import { HaravanAPIService } from '../haravan/haravan.api';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly statsService: StatsService,
    private readonly reviewService: ReviewService,
    private readonly reviewMetafield: ReviewMetafieldService,
    private readonly qnaService: QnaService,
    private readonly qnaMetafield: QnaMetafieldService,
    private readonly haravanAPI: HaravanAPIService,
  ) {}

  async getOverview(token: string, orgid: string) {
    // 1. Read stats (single metafield read — O(1))
    const stats = await this.statsService.getDecodedStats(token, orgid);

    // 2. Get products (cached) for names/images
    const productsRes = await this.haravanAPI.getProducts(token, {
      limit: '50',
    });
    const products = (productsRes?.products || []) as Array<{
      id: number | string;
      title?: string;
      image?: { src?: string };
    }>;
    const productMap = new Map(products.map((p) => [String(p.id), p]));

    // 3. Build ranked products (top 5 by review count)
    const rankedProducts = stats.products
      .filter((p) => p.reviewCount > 0)
      .sort(
        (a, b) => b.reviewCount - a.reviewCount || b.reviewAvg - a.reviewAvg,
      )
      .slice(0, 5)
      .map((p) => {
        const info = productMap.get(p.productId);
        return {
          id: p.productId,
          title: info?.title || `Sản phẩm #${p.productId}`,
          image: info?.image,
          count: p.reviewCount,
          avg: p.reviewAvg,
        };
      });

    // 4. Enrich recent reviews with product titles
    const recentReviews = stats.recentReviews.map((r) => {
      const info = productMap.get(r.productId);
      return {
        ...r,
        productTitle: info?.title || `Sản phẩm #${r.productId}`,
      };
    });

    return {
      productCount: products.length,
      totalReviews: stats.totalReviews,
      totalQuestions: stats.totalQuestions,
      totalAnswered: stats.totalAnswered,
      globalAvg: stats.globalAvg,
      globalDist: stats.globalDist,
      rankedProducts,
      recentReviews,
      // Extra: product stats for reviews/qna pages
      productStats: stats.products.map((p) => {
        const info = productMap.get(p.productId);
        return {
          ...p,
          title: info?.title,
          image: info?.image?.src,
        };
      }),
    };
  }

  /**
   * Rebuild stats from scratch by iterating products.
   * Use sparingly — makes many API calls.
   */
  async rebuildStats(token: string, orgid: string) {
    const productsRes = await this.haravanAPI.getProducts(token, {
      limit: '50',
    });
    const products = (productsRes?.products || []) as Array<{
      id: number | string;
      title?: string;
    }>;

    // Import metafield services for direct calculation
    const reviewMetafield = this.reviewMetafield;
    const qnaMetafield = this.qnaMetafield;

    const summaries: Array<{
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
    }> = [];

    for (const product of products) {
      const pid = String(product.id);
      try {
        // Load raw data and recalculate from scratch
        const [reviews, questions] = await Promise.all([
          reviewMetafield.loadReviews(token, pid).catch(() => []),
          qnaMetafield.loadQuestions(token, pid).catch(() => []),
        ]);

        const reviewSummary = reviewMetafield.calculateSummary(reviews);
        const qnaSummary = qnaMetafield.calculateSummary(questions);

        let recentReviews:
          | Array<{
              id: string;
              rating: number;
              author: string;
              content: string;
              created_at: number;
            }>
          | undefined;
        if (reviews.length > 0) {
          recentReviews = reviews.slice(0, 3).map((r) => ({
            id: r.id,
            rating: r.rating,
            author: r.author,
            content: r.content,
            created_at: r.created_at,
          }));
        }

        summaries.push({
          productId: pid,
          reviewSummary: {
            count: reviewSummary.count,
            avg: reviewSummary.avg,
            distribution: reviewSummary.distribution,
          },
          qnaSummary: {
            total: qnaSummary.total,
            answered: qnaSummary.answered,
          },
          recentReviews,
        });
      } catch (err) {
        this.logger.warn(
          `Rebuild: failed for product ${pid}: ${(err as Error)?.message}`,
        );
      }
    }

    const stats = await this.statsService.rebuildStats(token, orgid, summaries);
    return this.statsService.getDecodedStats(token, orgid);
  }
}
