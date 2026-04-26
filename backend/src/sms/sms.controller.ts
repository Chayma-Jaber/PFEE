import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { SmsService } from './sms.service';
import { SmsMessage, SmsPurpose, SmsStatus } from './entities/sms-message.entity';

@Controller('admin/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class SmsAdminController {
  constructor(
    private readonly sms: SmsService,
    @InjectRepository(SmsMessage) private readonly repo: Repository<SmsMessage>,
  ) {}

  @Get('stats')
  async stats() {
    const [total, sent, failed, pending] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { status: SmsStatus.SENT } }),
      this.repo.count({ where: { status: SmsStatus.FAILED } }),
      this.repo.count({ where: { status: SmsStatus.PENDING } }),
    ]);
    const deliveryRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0;
    return { total, sent, failed, pending, deliveryRate };
  }

  @Get('recent')
  async recent(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('purpose') purpose?: string,
  ) {
    const qb = this.repo.createQueryBuilder('s').orderBy('s.created_at', 'DESC').take(limit);
    if (status) qb.andWhere('s.status = :st', { st: status.toUpperCase() });
    if (purpose) qb.andWhere('s.purpose = :pu', { pu: purpose.toUpperCase() });
    const items = await qb.getMany();
    return { items };
  }

  @Post('test')
  async test(@Body() body: { to: string; message?: string }) {
    const row = await this.sms.sendSms({
      to: body.to,
      body: body.message || 'Barsha — Test SMS envoyé depuis le back-office.',
      purpose: SmsPurpose.ADMIN_TEST,
    });
    return {
      ok: row.status === SmsStatus.SENT,
      status: row.status,
      provider: row.provider,
      providerMessageId: row.provider_message_id,
      error: row.error_message,
      to: row.to,
    };
  }
}
