import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { CmsService } from './cms.service';

@Controller('storefront/pages')
@SkipTransform()
export class CmsPublicController {
  constructor(private readonly svc: CmsService) {}

  @Get(':slug')
  async byslug(
    @Param('slug') slug: string,
    @Query('locale', new DefaultValuePipe('fr')) locale = 'fr',
  ): Promise<any> {
    const page = await this.svc.getPublishedBySlug(slug, locale);
    return { page };
  }

  @Get()
  async list(@Query('locale', new DefaultValuePipe('fr')) locale = 'fr'): Promise<any> {
    return { items: await this.svc.listPublished(locale) };
  }
}

@Controller('admin/cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class CmsAdminController {
  constructor(private readonly svc: CmsService) {}

  @Get()
  async list(
    @Query('locale') locale?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    return { items: await this.svc.listAll({ locale, status }) };
  }

  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number): any { return this.svc.getById(id); }

  @Post()
  create(@CurrentUser('id') adminId: number, @Body() body: any): any {
    return this.svc.create(adminId, body);
  }

  @Put(':id')
  update(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ): any {
    return this.svc.update(adminId, id, body, body?.changeNote);
  }

  @Post(':id/publish')
  publish(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.publish(adminId, id);
  }

  @Post(':id/unpublish')
  unpublish(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.unpublish(adminId, id);
  }

  @Get(':id/revisions')
  async revisions(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return { items: await this.svc.listRevisions(id) };
  }

  @Post(':id/revert/:version')
  revert(
    @CurrentUser('id') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): any {
    return this.svc.revert(adminId, id, version);
  }

  // Surface broken/inactive product references inside this page's product-list blocks.
  @Get(':id/inactive-references')
  inactiveRefs(@Param('id', ParseIntPipe) id: number): any {
    return this.svc.checkInactiveReferences(id);
  }

  // One-click cleanup: strips problematic product IDs and saves a new revision.
  @Post(':id/cleanup-inactive-references')
  cleanupInactive(@CurrentUser('id') adminId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.cleanupInactiveReferences(adminId, id);
  }
}
