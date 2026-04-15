import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePriceDropAlertDto, CreateBackInStockAlertDto } from './dto/create-product-alert.dto';
import { AlertQueryDto } from './dto/alert-query.dto';

@Controller('alerts')
export class ProductAlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('price-drop')
  @UseGuards(OptionalAuthGuard)
  async createPriceDropAlert(
    @Body() dto: CreatePriceDropAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.createPriceDropAlert(dto, userId);
  }

  @Post('back-in-stock')
  @UseGuards(OptionalAuthGuard)
  async createBackInStockAlert(
    @Body() dto: CreateBackInStockAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.createBackInStockAlert(dto, userId);
  }

  @Get('my-alerts')
  @UseGuards(JwtAuthGuard)
  async getMyAlerts(
    @CurrentUser('id') userId: number,
    @Query() query: AlertQueryDto,
  ) {
    return this.alertsService.getUserProductAlerts(userId, query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAlert(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) alertId: number,
  ) {
    await this.alertsService.deleteProductAlert(alertId, userId);
  }

  @Delete('product/:productId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteByProduct(
    @CurrentUser('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.alertsService.deleteProductAlertByProduct(productId, userId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser('id') userId: number) {
    return this.alertsService.getAlertStats(userId);
  }
}
