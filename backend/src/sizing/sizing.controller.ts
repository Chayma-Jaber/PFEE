import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { SizingService } from './sizing.service';

@Controller('storefront/sizing')
@SkipTransform()
export class SizingStorefrontController {
  constructor(private readonly svc: SizingService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('id') userId: number) {
    const p = await this.svc.getProfile(userId);
    return { profile: p || null };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async upsertProfile(@CurrentUser('id') userId: number, @Body() body: any) {
    const saved = await this.svc.upsertProfile(userId, body);
    return { profile: saved };
  }

  @Get('recommend/:productId')
  @UseGuards(JwtAuthGuard)
  async recommend(@CurrentUser('id') userId: number, @Param('productId', ParseIntPipe) productId: number) {
    return this.svc.recommendForProduct(userId, productId);
  }
}

@Controller('admin/sizing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class SizingAdminController {
  constructor(private readonly svc: SizingService) {}

  @Get('charts')
  async list(@Query('brand') brand?: string, @Query('category') category?: string) {
    return { items: await this.svc.listCharts(brand, category) };
  }

  @Post('charts')
  upsert(@Body() body: any) {
    return this.svc.upsertChart(body);
  }

  @Put('charts/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.upsertChart({ ...body, id });
  }

  @Delete('charts/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteChart(id);
  }
}
