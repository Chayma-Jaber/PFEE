import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { ProductQA } from '../product-qa/entities/product-qa.entity';

@Controller('admin/qa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminQaController {
  constructor(
    @InjectRepository(ProductQA)
    private readonly qaRepo: Repository<ProductQA>,
  ) {}

  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('productId') productId?: string,
  ) {
    const qb = this.qaRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.user', 'u')
      .orderBy('q.created_at', 'DESC');

    if (status === 'unanswered') qb.andWhere('q.answer IS NULL');
    else if (status === 'answered') qb.andWhere('q.answer IS NOT NULL');
    else if (status === 'hidden') qb.andWhere('q.is_published = :p', { p: false });
    else if (status === 'published') qb.andWhere('q.is_published = :p', { p: true });
    if (productId) qb.andWhere('q.product_id = :pid', { pid: Number(productId) });

    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * limit).take(limit).getMany();
    const items = rows.map((q) => ({
      id: q.id,
      productId: q.product_id,
      userId: q.user_id,
      userName: q.user ? `${q.user.first_name || ''} ${q.user.last_name || ''}`.trim() : '—',
      userEmail: q.user?.email,
      question: q.question,
      answer: q.answer,
      answeredBy: q.answered_by,
      isPublished: q.is_published,
      helpfulCount: q.helpful_count,
      createdAt: q.created_at,
      answeredAt: q.answered_at,
    }));
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  @Get('stats')
  async stats() {
    const total = await this.qaRepo.count();
    const unanswered = await this.qaRepo
      .createQueryBuilder('q')
      .where('q.answer IS NULL')
      .getCount();
    const answered = await this.qaRepo
      .createQueryBuilder('q')
      .where('q.answer IS NOT NULL')
      .getCount();
    const hidden = await this.qaRepo.count({ where: { is_published: false } });
    return { total, unanswered, answered, hidden };
  }

  @Post(':id/answer')
  async answer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { answer: string },
    @CurrentUser('id') adminId: number,
  ) {
    if (!body.answer || !body.answer.trim()) {
      throw new BadRequestException('Réponse requise');
    }
    const q = await this.qaRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Q&A not found');
    q.answer = body.answer.trim();
    q.answered_by = adminId;
    q.answered_at = new Date();
    q.is_published = true;
    await this.qaRepo.save(q);
    return { success: true, answer: q.answer };
  }

  @Post(':id/toggle-publish')
  async togglePublish(@Param('id', ParseIntPipe) id: number) {
    const q = await this.qaRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Q&A not found');
    q.is_published = !q.is_published;
    await this.qaRepo.save(q);
    return { id, isPublished: q.is_published };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const q = await this.qaRepo.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Q&A not found');
    await this.qaRepo.remove(q);
    return { success: true };
  }
}
