import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DashboardPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class DashboardPeriodDto {
  @ApiPropertyOptional({ enum: DashboardPeriod, default: DashboardPeriod.MONTH })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;
}

export class DashboardStatsResponse {
  @ApiProperty()
  total_orders: number;

  @ApiProperty()
  total_revenue: number;

  @ApiProperty()
  total_customers: number;

  @ApiProperty()
  total_products: number;

  @ApiProperty()
  avg_order_value: number;

  @ApiProperty()
  period: string;
}

export class LowStockAlertResponse {
  @ApiProperty()
  product_id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  total_stock: number;

  @ApiProperty()
  threshold: number;
}
