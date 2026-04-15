import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockAlert } from './entities/stock-alert.entity';
import { ProductAlert } from './entities/product-alert.entity';
import { AlertsService } from './alerts.service';
import { StockAlertsController } from './stock-alerts.controller';
import { ProductAlertsController } from './product-alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StockAlert, ProductAlert])],
  controllers: [StockAlertsController, ProductAlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
