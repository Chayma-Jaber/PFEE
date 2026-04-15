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
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BundlesService } from './bundles.service';
import {
  CreateBundleDto,
  UpdateBundleDto,
  AddBundleToCartDto,
} from './dto/bundles.dto';

@Controller()
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get('bundles')
  async listBundles(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('active_only') activeOnly?: string,
  ) {
    const l = limit ? parseInt(limit, 10) : 20;
    const o = offset ? parseInt(offset, 10) : 0;
    const active = activeOnly !== 'false';
    const result = await this.bundlesService.listBundles(l, o, active);
    return { success: true, ...result };
  }

  @Get('bundles/featured')
  async getFeatured(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 6;
    const bundles = await this.bundlesService.getFeatured(l);
    return { success: true, bundles };
  }

  @Get('bundles/:id')
  async getBundle(@Param('id', ParseIntPipe) id: number) {
    const bundle = await this.bundlesService.getById(id);
    return { success: true, bundle };
  }

  @Post('bundles/:id/add-to-cart')
  @UseGuards(JwtAuthGuard)
  async addToCart(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() dto: AddBundleToCartDto,
  ) {
    const result = await this.bundlesService.addToCart(
      id,
      userId,
      dto.selected_variants,
    );
    return { success: true, ...result };
  }

  @Post('admin/bundles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER')
  async createBundle(@Body() dto: CreateBundleDto) {
    const bundle = await this.bundlesService.create(dto);
    return { success: true, bundle };
  }

  @Put('admin/bundles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER')
  async updateBundle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBundleDto,
  ) {
    const bundle = await this.bundlesService.update(id, dto);
    return { success: true, bundle };
  }

  @Delete('admin/bundles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER')
  async deleteBundle(@Param('id', ParseIntPipe) id: number) {
    await this.bundlesService.delete(id);
    return { success: true, message: 'Bundle deleted' };
  }
}
