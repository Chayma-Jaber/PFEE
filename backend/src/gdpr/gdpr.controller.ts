import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { GdprService } from './gdpr.service';
import { GdprRequestType } from './entities/gdpr-request.entity';

@Controller('storefront/gdpr')
@SkipTransform()
export class GdprStorefrontController {
  constructor(private readonly svc: GdprService) {}

  @Post('requests')
  @UseGuards(JwtAuthGuard)
  file(@CurrentUser('id') userId: number, @Body() body: { type: GdprRequestType; reason?: string }): any {
    return this.svc.fileRequest(userId, body?.type, body?.reason);
  }

  @Get('requests/mine')
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser('id') userId: number): Promise<any> {
    return { items: await this.svc.listMine(userId) };
  }

  // Public: customer clicks a verification link sent by email
  @Get('verify')
  verify(@Query('token') token: string): any {
    return this.svc.verify(token);
  }
}

@Controller('admin/gdpr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class GdprAdminController {
  constructor(private readonly svc: GdprService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('requests')
  async list(@Query('type') type?: string, @Query('status') status?: string): Promise<any> {
    return { items: await this.svc.adminList({ type, status }) };
  }

  @Post('requests/:id/run-export')
  runExport(@Param('id', ParseIntPipe) id: number): any { return this.svc.runExport(id); }

  @Post('requests/:id/run-erasure')
  runErasure(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number): any {
    return this.svc.runErasure(id, adminId);
  }

  @Post('requests/:id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { reason: string },
  ): any {
    return this.svc.reject(id, adminId, body?.reason || 'admin rejection');
  }
}
