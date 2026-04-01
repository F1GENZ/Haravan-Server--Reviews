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
  ValidationPipe,
} from '@nestjs/common';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { QnaService } from './qna.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  AnswerQuestionDto,
  UpdateQuestionStatusDto,
} from './dto/answer-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

@Controller('qna')
@UseGuards(ShopAuthGuard)
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Get(':productId')
  async getQuestions(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const questions = await this.qnaService.getQuestions(
      req.token,
      req.orgid,
      productId,
    );
    return { data: questions };
  }

  @Get(':productId/summary')
  async getSummary(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const summary = await this.qnaService.getSummary(
      req.token,
      req.orgid,
      productId,
    );
    return { data: summary };
  }

  @Post(':productId')
  async addQuestion(
    @Param('productId', NumericIdPipe) productId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateQuestionDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const question = await this.qnaService.addQuestion(
      req.token,
      req.orgid,
      productId,
      dto,
    );
    return { data: question };
  }

  @Put(':productId/:questionId/answer')
  async answerQuestion(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('questionId') questionId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AnswerQuestionDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const question = await this.qnaService.answerQuestion(
      req.token,
      req.orgid,
      productId,
      questionId,
      dto,
    );
    if (!question) throw new NotFoundException('Question not found');
    return { data: question };
  }

  @Put(':productId/:questionId/status')
  async updateStatus(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('questionId') questionId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateQuestionStatusDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const question = await this.qnaService.updateStatus(
      req.token,
      req.orgid,
      productId,
      questionId,
      dto,
    );
    if (!question) throw new NotFoundException('Question not found');
    return { data: question };
  }

  @Put(':productId/:questionId')
  async updateQuestion(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('questionId') questionId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateQuestionDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const question = await this.qnaService.updateQuestion(
      req.token,
      req.orgid,
      productId,
      questionId,
      dto,
    );
    if (!question) throw new NotFoundException('Question not found');
    return { data: question };
  }

  @Delete(':productId/:questionId')
  async deleteQuestion(
    @Param('productId', NumericIdPipe) productId: string,
    @Param('questionId') questionId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const deleted = await this.qnaService.deleteQuestion(
      req.token,
      req.orgid,
      productId,
      questionId,
    );
    if (!deleted) throw new NotFoundException('Question not found');
    return { data: { success: true } };
  }
}
