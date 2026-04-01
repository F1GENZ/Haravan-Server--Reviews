import { Injectable, Logger } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';
import type { Question, QnaSummary } from './interfaces/qna.interface';

const NAMESPACE = 'qna';
const CHUNK_SIZE_LIMIT = 60000;

@Injectable()
export class QnaMetafieldService {
  private readonly logger = new Logger(QnaMetafieldService.name);

  constructor(private readonly haravanAPI: HaravanAPIService) {}

  async loadQuestions(token: string, productId: string): Promise<Question[]> {
    const { questions } = await this.loadQuestionsWithMeta(token, productId);
    return questions;
  }

  /**
   * Load questions AND return raw metafields for reuse in writeQuestions.
   * Avoids a redundant getProductMetafields call during write operations.
   */
  async loadQuestionsWithMeta(
    token: string,
    productId: string,
  ): Promise<{ questions: Question[]; metafields: any[] }> {
    const metafields = await this.haravanAPI.getProductMetafields(
      token,
      productId,
      NAMESPACE,
    );

    const chunks = metafields
      .filter((m) => m.key && String(m.key).startsWith('chunk_'))
      .sort((a, b) => {
        const numA = parseInt(String(a.key).replace('chunk_', ''), 10);
        const numB = parseInt(String(b.key).replace('chunk_', ''), 10);
        return numA - numB;
      });

    const questions: Question[] = [];
    for (const chunk of chunks) {
      try {
        const value =
          typeof chunk.value === 'string'
            ? chunk.value
            : String(chunk.value ?? '');
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
          questions.push(...(parsed as Question[]));
        }
      } catch {
        this.logger.warn(
          `Failed to parse QnA chunk ${String(chunk.key)} for product ${productId}`,
        );
      }
    }

    return { questions, metafields };
  }

  async loadSummary(
    token: string,
    productId: string,
  ): Promise<QnaSummary | null> {
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
      return JSON.parse(value) as QnaSummary;
    } catch {
      return null;
    }
  }

  async writeQuestions(
    token: string,
    productId: string,
    questions: Question[],
    summary: QnaSummary,
    preloadedMetafields?: any[],
  ): Promise<void> {
    const existing =
      preloadedMetafields ??
      (await this.haravanAPI.getProductMetafields(token, productId, NAMESPACE));

    const existingChunks = existing
      .filter((m) => m.key && String(m.key).startsWith('chunk_'))
      .sort((a, b) => {
        const numA = parseInt(String(a.key).replace('chunk_', ''), 10);
        const numB = parseInt(String(b.key).replace('chunk_', ''), 10);
        return numA - numB;
      });

    const existingSummary = existing.find((m) => m.key === 'summary');

    const newChunks = this.chunkQuestions(questions);

    // Write summary
    const summaryValue = JSON.stringify(summary);
    if (existingSummary && existingSummary.id) {
      await this.haravanAPI.updateProductMetafield(
        token,
        productId,
        String(existingSummary.id),
        { value: summaryValue, value_type: 'json' },
      );
    } else {
      await this.haravanAPI.createProductMetafield(token, productId, {
        namespace: NAMESPACE,
        key: 'summary',
        value: summaryValue,
        value_type: 'json',
      });
    }

    // Write chunks
    for (let i = 0; i < newChunks.length; i++) {
      const key = `chunk_${i + 1}`;
      const value = newChunks[i];
      const existingChunk = existingChunks.find((c) => c.key === key);

      if (existingChunk && existingChunk.id) {
        await this.haravanAPI.updateProductMetafield(
          token,
          productId,
          String(existingChunk.id),
          { value, value_type: 'string' },
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
      const chunkNum = parseInt(String(oldChunk.key).replace('chunk_', ''), 10);
      if (chunkNum > newChunks.length && oldChunk.id) {
        await this.haravanAPI.deleteProductMetafield(
          token,
          productId,
          String(oldChunk.id),
        );
      }
    }
  }

  private chunkQuestions(questions: Question[]): string[] {
    if (questions.length === 0) return [];

    const chunks: string[] = [];
    let currentBatch: Question[] = [];

    for (const q of questions) {
      currentBatch.push(q);
      const serialized = JSON.stringify(currentBatch);

      if (serialized.length > CHUNK_SIZE_LIMIT) {
        currentBatch.pop();
        if (currentBatch.length > 0) {
          chunks.push(JSON.stringify(currentBatch));
        }
        currentBatch = [q];
      }
    }

    if (currentBatch.length > 0) {
      chunks.push(JSON.stringify(currentBatch));
    }

    return chunks;
  }

  calculateSummary(questions: Question[]): QnaSummary {
    const total = questions.length;
    const answered = questions.filter((q) => !!q.answer).length;
    return { total, answered, unanswered: total - answered };
  }
}
