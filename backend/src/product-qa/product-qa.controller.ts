import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProductQAService } from './product-qa.service';
import { AskQuestionDto, AnswerQuestionDto } from './dto/product-qa.dto';

@ApiTags('Product Q&A')
@Controller()
export class ProductQAController {
  constructor(private readonly qaService: ProductQAService) {}

  @Get('products/:productId/questions')
  async getProductQuestions(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.qaService.getProductQuestions(productId, page || 1, limit || 10);
  }

  @Post('products/:productId/questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async askQuestion(
    @Param('productId', ParseIntPipe) productId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: AskQuestionDto,
  ) {
    return this.qaService.askQuestion(productId, userId, dto);
  }

  @Post('admin/qa/:id/answer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  async answerQuestion(
    @Param('id', ParseIntPipe) qaId: number,
    @CurrentUser('id') adminId: number,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.qaService.answerQuestion(qaId, adminId, dto);
  }

  @Delete('admin/qa/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  async deleteQuestion(@Param('id', ParseIntPipe) qaId: number) {
    return this.qaService.deleteQuestion(qaId);
  }
}
