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
import { OutfitsService } from './outfits.service';
import { CreateOutfitDto, UpdateOutfitDto } from './dto/outfits.dto';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

@SkipTransform()
@Controller()
export class OutfitsController {
  constructor(private readonly outfitsService: OutfitsService) {}

  @Get('outfits')
  async listOutfits() {
    const outfits = await this.outfitsService.listPublished();
    return { success: true, outfits };
  }

  @Get('outfits/featured')
  async getFeatured(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 6;
    const outfits = await this.outfitsService.getFeatured(l);
    return { success: true, outfits };
  }

  @Get('outfits/by-occasion/:occasion')
  async getByOccasion(@Param('occasion') occasion: string) {
    const outfits = await this.outfitsService.getByOccasion(occasion);
    return { success: true, outfits };
  }

  @Get('outfits/for-product/:productId')
  async getForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('limit') limit?: string,
  ) {
    const outfits = await this.outfitsService.getByProduct(
      productId,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { success: true, outfits };
  }

  @Get('outfits/:id')
  async getOutfit(@Param('id', ParseIntPipe) id: number) {
    const outfit = await this.outfitsService.getById(id);
    return { success: true, outfit };
  }

  @Post('admin/outfits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'CATALOG_MANAGER')
  async createOutfit(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateOutfitDto,
  ) {
    const outfit = await this.outfitsService.create(dto, userId);
    return { success: true, outfit };
  }

  @Put('admin/outfits/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'CATALOG_MANAGER')
  async updateOutfit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOutfitDto,
  ) {
    const outfit = await this.outfitsService.update(id, dto);
    return { success: true, outfit };
  }

  @Delete('admin/outfits/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'CATALOG_MANAGER')
  async deleteOutfit(@Param('id', ParseIntPipe) id: number) {
    await this.outfitsService.delete(id);
    return { success: true, message: 'Outfit deleted' };
  }
}
