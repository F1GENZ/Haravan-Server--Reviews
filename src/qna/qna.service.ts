import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { QnaMetafieldService } from './qna-metafield.service';
import { StatsService } from '../stats/stats.service';
import type { Question, QnaSummary } from './interfaces/qna.interface';
import type { CreateQuestionDto } from './dto/create-question.dto';
import type { UpdateQuestionDto } from './dto/update-question.dto';
import type {
  AnswerQuestionDto,
  UpdateQuestionStatusDto,
} from './dto/answer-question.dto';
import { randomBytes } from 'crypto';
import { sanitizeText } from '../common/utils/sanitize';

const LOCK_TTL = 30;
const LOCK_MAX_RETRIES = 4;
const LOCK_BASE_DELAY = 500;

const generateId = (): string => randomBytes(12).toString('base64url');

@Injectable()
export class QnaService {
  private readonly logger = new Logger(QnaService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly metafieldService: QnaMetafieldService,
    private readonly statsService: StatsService,
  ) {}

  private lockKey(orgid: string, productId: string): string {
    return `lock:qna:${orgid}:${productId}`;
  }

  async getQuestions(
    token: string,
    orgid: string,
    productId: string,
  ): Promise<Question[]> {
    return this.metafieldService.loadQuestions(token, productId);
  }

  async getSummary(
    token: string,
    orgid: string,
    productId: string,
  ): Promise<QnaSummary> {
    const summary = await this.metafieldService.loadSummary(token, productId);
    return summary || { total: 0, answered: 0, unanswered: 0 };
  }

  async addQuestion(
    token: string,
    orgid: string,
    productId: string,
    dto: CreateQuestionDto,
  ): Promise<Question> {
    await this.acquireLock(orgid, productId);
    try {
      const { questions, metafields } =
        await this.metafieldService.loadQuestionsWithMeta(token, productId);

      const question: Question = {
        id: generateId(),
        question: sanitizeText(dto.question),
        author: sanitizeText(dto.author),
        email: dto.email,
        status: 'pending',
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      questions.unshift(question);
      const summary = this.metafieldService.calculateSummary(questions);
      await this.metafieldService.writeQuestions(
        token,
        productId,
        questions,
        summary,
        metafields,
      );

      this.statsService
        .updateProductQnaStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return question;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async answerQuestion(
    token: string,
    orgid: string,
    productId: string,
    questionId: string,
    dto: AnswerQuestionDto,
  ): Promise<Question | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { questions, metafields } =
        await this.metafieldService.loadQuestionsWithMeta(token, productId);
      const index = questions.findIndex((q) => q.id === questionId);
      if (index === -1) return null;

      const question = questions[index];
      question.answer = sanitizeText(dto.answer);
      question.answered_by = dto.answered_by
        ? sanitizeText(dto.answered_by)
        : 'Shop';
      question.answered_at = Date.now();
      question.status = 'approved';
      question.updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(questions);
      await this.metafieldService.writeQuestions(
        token,
        productId,
        questions,
        summary,
        metafields,
      );

      this.statsService
        .updateProductQnaStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return question;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async updateStatus(
    token: string,
    orgid: string,
    productId: string,
    questionId: string,
    dto: UpdateQuestionStatusDto,
  ): Promise<Question | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { questions, metafields } =
        await this.metafieldService.loadQuestionsWithMeta(token, productId);
      const index = questions.findIndex((q) => q.id === questionId);
      if (index === -1) return null;

      questions[index].status = dto.status;
      questions[index].updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(questions);
      await this.metafieldService.writeQuestions(
        token,
        productId,
        questions,
        summary,
        metafields,
      );

      this.statsService
        .updateProductQnaStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return questions[index];
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async updateQuestion(
    token: string,
    orgid: string,
    productId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<Question | null> {
    await this.acquireLock(orgid, productId);
    try {
      const { questions, metafields } =
        await this.metafieldService.loadQuestionsWithMeta(token, productId);
      const index = questions.findIndex((q) => q.id === questionId);
      if (index === -1) return null;

      const question = questions[index];
      if (dto.question !== undefined)
        question.question = sanitizeText(dto.question);
      if (dto.author !== undefined)
        question.author = sanitizeText(dto.author);
      if (dto.email !== undefined) question.email = dto.email;
      if (dto.answer !== undefined)
        question.answer = sanitizeText(dto.answer);
      if (dto.answered_by !== undefined)
        question.answered_by = sanitizeText(dto.answered_by);
      question.updated_at = Date.now();

      const summary = this.metafieldService.calculateSummary(questions);
      await this.metafieldService.writeQuestions(
        token,
        productId,
        questions,
        summary,
        metafields,
      );

      this.statsService
        .updateProductQnaStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return question;
    } finally {
      await this.releaseLock(orgid, productId);
    }
  }

  async deleteQuestion(
    token: string,
    orgid: string,
    productId: string,
    questionId: string,
  ): Promise<boolean> {
    await this.acquireLock(orgid, productId);
    try {
      const { questions, metafields } =
        await this.metafieldService.loadQuestionsWithMeta(token, productId);
      const filtered = questions.filter((q) => q.id !== questionId);
      if (filtered.length === questions.length) return false;

      const summary = this.metafieldService.calculateSummary(filtered);
      await this.metafieldService.writeQuestions(
        token,
        productId,
        filtered,
        summary,
        metafields,
      );

      this.statsService
        .updateProductQnaStats(token, orgid, productId, summary)
        .catch((e) => this.logger.warn(`Stats update failed: ${e?.message}`));

      return true;
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
    throw new Error(`Write lock busy for QnA product ${productId}`);
  }

  private async releaseLock(orgid: string, productId: string): Promise<void> {
    await this.redis.del(this.lockKey(orgid, productId));
  }
}
