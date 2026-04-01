import { Injectable, Logger } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';
import type { Review, RatingSummary } from './interfaces/review.interface';

const NAMESPACE = 'reviews';
const CHUNK_SIZE_LIMIT = 60000; // 60K chars, leave headroom for 80K max

@Injectable()
export class ReviewMetafieldService {
  private readonly logger = new Logger(ReviewMetafieldService.name);

  constructor(private readonly haravanAPI: HaravanAPIService) {}

  /**
   * Load ALL reviews (admin-facing) from data_chunk_* keys.
   * Falls back to chunk_* for backward compat (pre-split data).
   */
  async loadReviews(token: string, productId: string): Promise<Review[]> {
    const { reviews } = await this.loadReviewsWithMeta(token, productId);
    return reviews;
  }

  /**
   * Load reviews AND return raw metafields for reuse in writeReviews.
   * Avoids a redundant getProductMetafields call during write operations.
   */
  async loadReviewsWithMeta(
    token: string,
    productId: string,
  ): Promise<{ reviews: Review[]; metafields: any[] }> {
    const metafields = await this.haravanAPI.getProductMetafields(
      token,
      productId,
      NAMESPACE,
    );

    // Try data_chunk_* first (new format — contains all statuses)
    const dataChunks = metafields
      .filter((m) => m.key && String(m.key).startsWith('data_chunk_'))
      .sort((a, b) => {
        const numA = parseInt(String(a.key).replace('data_chunk_', ''), 10);
        const numB = parseInt(String(b.key).replace('data_chunk_', ''), 10);
        return numA - numB;
      });

    if (dataChunks.length > 0) {
      return { reviews: this.parseChunks(dataChunks, productId), metafields };
    }

    // Fallback: read from chunk_* (old format — all are approved)
    const chunks = metafields
      .filter((m) => m.key && String(m.key).startsWith('chunk_'))
      .sort((a, b) => {
        const numA = parseInt(String(a.key).replace('chunk_', ''), 10);
        const numB = parseInt(String(b.key).replace('chunk_', ''), 10);
        return numA - numB;
      });

    const reviews = this.parseChunks(chunks, productId);
    // Old reviews have no status field → treat as approved
    for (const r of reviews) {
      if (!r.status) r.status = 'approved';
    }
    return { reviews, metafields };
  }

  private parseChunks(chunks: any[], productId: string): Review[] {
    const reviews: Review[] = [];
    for (const chunk of chunks) {
      try {
        const value =
          typeof chunk.value === 'string'
            ? chunk.value
            : String(chunk.value ?? '');
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
          reviews.push(...(parsed as Review[]));
        }
      } catch {
        this.logger.warn(
          `Failed to parse chunk ${String(chunk.key)} for product ${productId}`,
        );
      }
    }
    return reviews;
  }

  async loadSummary(
    token: string,
    productId: string,
  ): Promise<RatingSummary | null> {
    const metafields = await this.haravanAPI.getProductMetafields(
      token,
      productId,
      NAMESPACE,
    );

    const summaryField = metafields.find((m) => m.key === 'summary');
    if (!summaryField || !summaryField.value) return null;

    try {
      const value =
        typeof summaryField.value === 'string'
          ? summaryField.value
          : JSON.stringify(summaryField.value);
      return JSON.parse(value) as RatingSummary;
    } catch {
      return null;
    }
  }

  /**
   * Write reviews to metafields in two sets:
   * - chunk_* = public (approved only, for storefront Liquid)
   * - data_chunk_* = all reviews incl. spam/hidden/pending (for admin)
   */
  async writeReviews(
    token: string,
    productId: string,
    allReviews: Review[],
    summary: RatingSummary,
    preloadedMetafields?: any[],
  ): Promise<void> {
    const existing =
      preloadedMetafields ??
      (await this.haravanAPI.getProductMetafields(token, productId, NAMESPACE));

    const existingSummary = existing.find((m) => m.key === 'summary');

    // Write summary
    const summaryValue = JSON.stringify(summary);
    if (existingSummary && existingSummary.id) {
      await this.haravanAPI.updateProductMetafield(
        token,
        productId,
        String(existingSummary.id),
        {
          value: summaryValue,
          value_type: 'json',
        },
      );
    } else {
      await this.haravanAPI.createProductMetafield(token, productId, {
        namespace: NAMESPACE,
        key: 'summary',
        value: summaryValue,
        value_type: 'json',
      });
    }

    // ── Public chunks (approved only, for storefront) ──
    const approvedReviews = allReviews.filter(
      (r) => (r.status || 'approved') === 'approved',
    );
    // Strip `status` field from public chunks to save space
    const publicReviews = approvedReviews.map(({ status, ...rest }) => rest);
    await this.writeChunkSet(
      token,
      productId,
      existing,
      'chunk_',
      publicReviews,
    );

    // ── Admin data chunks (all reviews with status) ──
    await this.writeChunkSet(
      token,
      productId,
      existing,
      'data_chunk_',
      allReviews,
    );
  }

  private async writeChunkSet(
    token: string,
    productId: string,
    existingMetafields: any[],
    prefix: string,
    reviews: any[],
  ): Promise<void> {
    const existingChunks = existingMetafields
      .filter((m) => m.key && String(m.key).startsWith(prefix))
      .sort((a, b) => {
        const numA = parseInt(String(a.key).replace(prefix, ''), 10);
        const numB = parseInt(String(b.key).replace(prefix, ''), 10);
        return numA - numB;
      });

    const newChunks = this.chunkReviews(reviews);

    for (let i = 0; i < newChunks.length; i++) {
      const key = `${prefix}${i + 1}`;
      const value = newChunks[i];
      const existingChunk = existingChunks.find((c) => c.key === key);

      if (existingChunk && existingChunk.id) {
        await this.haravanAPI.updateProductMetafield(
          token,
          productId,
          String(existingChunk.id),
          {
            value,
            value_type: 'string',
          },
        );
      } else {
        await this.haravanAPI.createProductMetafield(token, productId, {
          namespace: NAMESPACE,
          key,
          value,
          value_type: 'string',
        });
      }
    }

    // Delete excess old chunks
    for (const oldChunk of existingChunks) {
      const chunkNum = parseInt(String(oldChunk.key).replace(prefix, ''), 10);
      if (chunkNum > newChunks.length && oldChunk.id) {
        await this.haravanAPI.deleteProductMetafield(
          token,
          productId,
          String(oldChunk.id),
        );
      }
    }
  }

  private chunkReviews(reviews: Review[]): string[] {
    if (reviews.length === 0) return [];

    const chunks: string[] = [];
    let currentBatch: Review[] = [];

    for (const review of reviews) {
      currentBatch.push(review);
      const serialized = JSON.stringify(currentBatch);

      if (serialized.length > CHUNK_SIZE_LIMIT) {
        // Remove the last one that exceeded
        currentBatch.pop();
        if (currentBatch.length > 0) {
          chunks.push(JSON.stringify(currentBatch));
        }
        currentBatch = [review];
      }
    }

    if (currentBatch.length > 0) {
      chunks.push(JSON.stringify(currentBatch));
    }

    return chunks;
  }

  calculateSummary(reviews: Review[]): RatingSummary {
    // Only count approved reviews in public-facing summary
    const visible = reviews.filter(
      (r) => (r.status || 'approved') === 'approved',
    );
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<
      number,
      number
    >;
    for (const review of visible) {
      if (review.rating >= 1 && review.rating <= 5) {
        distribution[review.rating]++;
      }
    }

    const count = visible.length;
    const avg =
      count > 0
        ? Math.round(
            (visible.reduce((sum, r) => sum + r.rating, 0) / count) * 10,
          ) / 10
        : 0;

    return {
      avg,
      count,
      distribution: distribution as RatingSummary['distribution'],
    };
  }
}
