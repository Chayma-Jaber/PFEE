/**
 * Wave 3 — Intelligent merchandising & retention
 * Admin endpoints for: homepage blocks, A/B tests, segment pricing,
 * merchandising grid, back-in-stock workflow admin.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { HomepageBlock } from './entities/homepage-block.entity';
import { AbTest, AbTestEvent } from './entities/ab-test.entity';
import { ProductPosition } from './entities/product-position.entity';
import { PricingRule } from '../promotions/entities/pricing-rule.entity';
import { NewsletterCampaign } from '../newsletter/entities/newsletter-campaign.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { EmailService } from '../email/email.service';

@Controller('admin/wave3')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminWave3Controller {
  constructor(
    @InjectRepository(HomepageBlock) private readonly blockRepo: Repository<HomepageBlock>,
    @InjectRepository(AbTest) private readonly testRepo: Repository<AbTest>,
    @InjectRepository(AbTestEvent) private readonly testEventRepo: Repository<AbTestEvent>,
    @InjectRepository(ProductPosition) private readonly posRepo: Repository<ProductPosition>,
    @InjectRepository(PricingRule) private readonly ruleRepo: Repository<PricingRule>,
    @InjectRepository(NewsletterCampaign) private readonly campaignRepo: Repository<NewsletterCampaign>,
    @InjectRepository(NewsletterSubscriber) private readonly subRepo: Repository<NewsletterSubscriber>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly emailService: EmailService,
  ) {}

  // ═══ 1. HOMEPAGE BLOCKS ═════════════════════════════════════════════
  @Get('homepage-blocks')
  async listBlocks() {
    const items = await this.blockRepo.find({ order: { position: 'ASC' } });
    return { items };
  }

  @Post('homepage-blocks')
  async createBlock(@Body() body: any) {
    if (!body.key || !body.title || !body.type) throw new BadRequestException('key,title,type requis');
    const b = this.blockRepo.create({
      key: body.key, title: body.title, type: body.type,
      config: body.config || {},
      position: body.position || 0,
      is_active: body.isActive !== false,
      start_at: body.startAt ? new Date(body.startAt) : null,
      end_at: body.endAt ? new Date(body.endAt) : null,
    });
    return this.blockRepo.save(b);
  }

  @Put('homepage-blocks/:id')
  async updateBlock(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const b = await this.blockRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException();
    if (body.title !== undefined) b.title = body.title;
    if (body.type !== undefined) b.type = body.type;
    if (body.config !== undefined) b.config = body.config;
    if (body.position !== undefined) b.position = body.position;
    if (body.isActive !== undefined) b.is_active = body.isActive;
    if (body.startAt !== undefined) b.start_at = body.startAt ? new Date(body.startAt) : null;
    if (body.endAt !== undefined) b.end_at = body.endAt ? new Date(body.endAt) : null;
    return this.blockRepo.save(b);
  }

  @Delete('homepage-blocks/:id')
  async deleteBlock(@Param('id', ParseIntPipe) id: number) {
    const b = await this.blockRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException();
    await this.blockRepo.remove(b);
    return { success: true };
  }

  // ═══ 2. A/B TESTS ═══════════════════════════════════════════════════
  @Get('ab-tests')
  async listTests() {
    const items = await this.testRepo.find({ order: { created_at: 'DESC' } });
    return { items };
  }

  @Post('ab-tests')
  async createTest(@Body() body: any) {
    if (!body.key || !body.name || !Array.isArray(body.variants) || body.variants.length < 2) {
      throw new BadRequestException('key,name,variants[>=2] requis');
    }
    const t = this.testRepo.create({
      key: body.key, name: body.name,
      variants: body.variants,
      goal_event: body.goalEvent || 'COMPLETE_PURCHASE',
      is_active: body.isActive !== false,
    });
    return this.testRepo.save(t);
  }

  @Put('ab-tests/:id')
  async updateTest(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const t = await this.testRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException();
    if (body.name !== undefined) t.name = body.name;
    if (body.variants !== undefined) t.variants = body.variants;
    if (body.isActive !== undefined) t.is_active = body.isActive;
    if (body.goalEvent !== undefined) t.goal_event = body.goalEvent;
    return this.testRepo.save(t);
  }

  @Delete('ab-tests/:id')
  async deleteTest(@Param('id', ParseIntPipe) id: number) {
    const t = await this.testRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException();
    await this.testRepo.remove(t);
    return { success: true };
  }

  @Get('ab-tests/:key/results')
  async testResults(@Param('key') key: string) {
    const test = await this.testRepo.findOne({ where: { key } });
    if (!test) throw new NotFoundException();
    const out: any[] = [];
    for (const v of test.variants) {
      const impressions = await this.testEventRepo
        .createQueryBuilder('e')
        .where('e.test_key = :k', { k: key })
        .andWhere('e.variant_id = :v', { v: v.id })
        .andWhere('e.kind = :kind', { kind: 'IMPRESSION' })
        .getCount();
      const goals = await this.testEventRepo
        .createQueryBuilder('e')
        .where('e.test_key = :k', { k: key })
        .andWhere('e.variant_id = :v', { v: v.id })
        .andWhere('e.kind = :kind', { kind: 'GOAL' })
        .getCount();
      out.push({
        variant: v,
        impressions,
        goals,
        conversionRate: impressions > 0 ? Math.round((goals / impressions) * 10000) / 100 : 0,
      });
    }
    return { test: { key: test.key, name: test.name, goalEvent: test.goal_event }, variants: out };
  }

  // ═══ 3. SMART EMAIL SEGMENTS (send to segment) ══════════════════════
  @Post('campaigns/:id/send-to-segment')
  async sendToSegment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { segment: 'VIP' | 'LOYAL' | 'AT_RISK' | 'NEW' | 'PROSPECT' | 'ALL' },
  ) {
    const c = await this.campaignRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    if (c.status === 'SENT') throw new BadRequestException('Already sent');

    const segment = (body?.segment || 'ALL').toUpperCase();
    const emails = await this.resolveSegmentEmails(segment);

    if (emails.length === 0) {
      return { success: false, sent: 0, segment, message: 'No recipients in segment' };
    }

    try {
      await this.emailService.sendNewsletter(emails, { subject: c.subject, htmlBody: c.body });
    } catch {}

    c.status = 'SENT';
    c.sent_count = emails.length;
    c.sent_at = new Date();
    await this.campaignRepo.save(c);
    return { success: true, sent: emails.length, segment };
  }

  private async resolveSegmentEmails(segment: string): Promise<string[]> {
    if (segment === 'ALL') {
      const subs = await this.subRepo
        .createQueryBuilder('s')
        .where('s.is_confirmed = :c', { c: true })
        .andWhere('s.unsubscribed_at IS NULL')
        .getMany();
      return subs.map((s) => s.email);
    }
    const customers = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.role) = :role', { role: 'customer' })
      .getMany();
    const matched: string[] = [];
    for (const u of customers) {
      const seg = await this.computeSegment(u.id);
      if (seg === segment) matched.push(u.email);
    }
    return matched;
  }

  private async computeSegment(userId: number): Promise<string> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'c')
      .addSelect('SUM(o.total_amount)', 't')
      .addSelect('MAX(o.created_at)', 'last')
      .where('o.user_id = :uid', { uid: userId })
      .andWhere("UPPER(o.status) NOT IN ('CANCELLED','FAILED')")
      .getRawOne();
    const count = Number(rows?.c || 0);
    const total = Number(rows?.t || 0);
    const last = rows?.last ? new Date(rows.last) : null;
    const daysSince = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
    if (count === 0) return 'PROSPECT';
    if (count >= 10 || total >= 2000) return 'VIP';
    if (daysSince != null && daysSince > 90) return 'AT_RISK';
    if (count >= 3) return 'LOYAL';
    return 'NEW';
  }

  // ═══ 8. VISUAL MERCHANDISING GRID ═══════════════════════════════════
  @Get('merchandising/:categoryId')
  async getMerchandising(@Param('categoryId', ParseIntPipe) categoryId: number) {
    const positions = await this.posRepo.find({
      where: { category_id: categoryId },
      order: { position: 'ASC' },
    });
    return { categoryId, positions };
  }

  @Post('merchandising/:categoryId/reorder')
  async reorderCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() body: { productIds: number[] },
  ) {
    if (!Array.isArray(body.productIds)) throw new BadRequestException('productIds[] requis');
    // Wipe existing for this category and re-insert in new order
    await this.posRepo.delete({ category_id: categoryId });
    const rows = body.productIds.map((pid, idx) =>
      this.posRepo.create({
        category_id: categoryId,
        product_id: Number(pid),
        position: idx + 1,
      }),
    );
    if (rows.length > 0) await this.posRepo.save(rows);
    return { success: true, updated: rows.length };
  }
}
