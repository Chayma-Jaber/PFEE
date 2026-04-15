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
import { CreateStockAlertDto } from './dto/create-stock-alert.dto';
import { AlertQueryDto } from './dto/alert-query.dto';
import { CheckStockAlertDto } from './dto/check-stock-alert.dto';

@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  async createStockAlert(
    @Body() dto: CreateStockAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.createStockAlert(dto, userId);
  }

  @Get('my-alerts')
  @UseGuards(JwtAuthGuard)
  async getMyAlerts(
    @CurrentUser('id') userId: number,
    @Query() query: AlertQueryDto,
  ) {
    return this.alertsService.getUserStockAlerts(userId, query);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAlert(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) alertId: number,
  ) {
    await this.alertsService.deleteStockAlert(alertId, userId);
  }

  @Post('check/:productId')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkAlert(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CheckStockAlertDto,
    @CurrentUser('id') userId?: number,
  ) {
    return this.alertsService.checkStockAlert(productId, dto, userId);
  }
}
