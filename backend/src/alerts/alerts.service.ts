import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockAlert } from './entities/stock-alert.entity';
import { ProductAlert, AlertType } from './entities/product-alert.entity';
import { CreateStockAlertDto } from './dto/create-stock-alert.dto';
import { CreatePriceDropAlertDto, CreateBackInStockAlertDto } from './dto/create-product-alert.dto';
import { AlertQueryDto } from './dto/alert-query.dto';
import { CheckStockAlertDto } from './dto/check-stock-alert.dto';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(StockAlert)
    private readonly stockAlertRepo: Repository<StockAlert>,
    @InjectRepository(ProductAlert)
    private readonly productAlertRepo: Repository<ProductAlert>,
  ) {}

  // ─── Stock Alerts ───────────────────────────────────────────────

  async createStockAlert(
    dto: CreateStockAlertDto,
    userId?: number,
  ): Promise<StockAlert> {
    // Check for duplicate
    const existing = await this.stockAlertRepo.findOne({
      where: {
        product_id: dto.product_id,
        email: dto.email,
        size: dto.size || undefined,
        color: dto.color || undefined,
        is_notified: false,
      },
    });

    if (existing) {
      throw new ConflictException('An alert for this product variant already exists');
    }

    const alert = this.stockAlertRepo.create({
      ...dto,
      user_id: userId || null,
    });

    return this.stockAlertRepo.save(alert);
  }

  async getUserStockAlerts(
    userId: number,
    query: AlertQueryDto,
  ): Promise<{ alerts: StockAlert[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [alerts, total] = await this.stockAlertRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total, page, limit };
  }

  async deleteStockAlert(alertId: number, userId: number): Promise<void> {
    const alert = await this.stockAlertRepo.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new NotFoundException(`Stock alert #${alertId} not found`);
    }

    if (alert.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this alert');
    }

    await this.stockAlertRepo.remove(alert);
  }

  async checkStockAlert(
    productId: number,
    dto: CheckStockAlertDto,
    userId?: number,
  ): Promise<{ exists: boolean; alert?: StockAlert }> {
    const where: any = {
      product_id: productId,
      is_notified: false,
    };

    if (userId) {
      where.user_id = userId;
    } else if (dto.email) {
      where.email = dto.email;
    }

    if (dto.size) where.size = dto.size;
    if (dto.color) where.color = dto.color;

    const alert = await this.stockAlertRepo.findOne({ where });

    return { exists: !!alert, alert: alert || undefined };
  }

  // ─── Product Alerts (Price Drop & Back In Stock) ────────────────

  async createPriceDropAlert(
    dto: CreatePriceDropAlertDto,
    userId?: number,
  ): Promise<ProductAlert> {
    const existing = await this.productAlertRepo.findOne({
      where: {
        product_id: dto.product_id,
        email: dto.email,
        alert_type: AlertType.PRICE_DROP,
        is_triggered: false,
      },
    });

    if (existing) {
      throw new ConflictException('A price drop alert for this product already exists');
    }

    const alert = this.productAlertRepo.create({
      product_id: dto.product_id,
      email: dto.email,
      alert_type: AlertType.PRICE_DROP,
      target_price: dto.target_price || null,
      current_price: dto.current_price,
      user_id: userId || null,
    });

    return this.productAlertRepo.save(alert);
  }

  async createBackInStockAlert(
    dto: CreateBackInStockAlertDto,
    userId?: number,
  ): Promise<ProductAlert> {
    const existing = await this.productAlertRepo.findOne({
      where: {
        product_id: dto.product_id,
        email: dto.email,
        alert_type: AlertType.BACK_IN_STOCK,
        is_triggered: false,
      },
    });

    if (existing) {
      throw new ConflictException('A back-in-stock alert for this product already exists');
    }

    const alert = this.productAlertRepo.create({
      product_id: dto.product_id,
      email: dto.email,
      alert_type: AlertType.BACK_IN_STOCK,
      current_price: dto.current_price,
      user_id: userId || null,
    });

    return this.productAlertRepo.save(alert);
  }

  async getUserProductAlerts(
    userId: number,
    query: AlertQueryDto,
  ): Promise<{ alerts: ProductAlert[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [alerts, total] = await this.productAlertRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { alerts, total, page, limit };
  }

  async deleteProductAlert(alertId: number, userId: number): Promise<void> {
    const alert = await this.productAlertRepo.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new NotFoundException(`Product alert #${alertId} not found`);
    }

    if (alert.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this alert');
    }

    await this.productAlertRepo.remove(alert);
  }

  async deleteProductAlertByProduct(productId: number, userId: number): Promise<{ deleted: number }> {
    const alerts = await this.productAlertRepo.find({
      where: { product_id: productId, user_id: userId },
    });

    if (alerts.length === 0) {
      throw new NotFoundException(`No alerts found for product #${productId}`);
    }

    await this.productAlertRepo.remove(alerts);
    return { deleted: alerts.length };
  }

  async getAlertStats(userId: number): Promise<{
    total_alerts: number;
    active_price_drop: number;
    active_back_in_stock: number;
    triggered: number;
  }> {
    const total_alerts = await this.productAlertRepo.count({
      where: { user_id: userId },
    });

    const active_price_drop = await this.productAlertRepo.count({
      where: { user_id: userId, alert_type: AlertType.PRICE_DROP, is_triggered: false },
    });

    const active_back_in_stock = await this.productAlertRepo.count({
      where: { user_id: userId, alert_type: AlertType.BACK_IN_STOCK, is_triggered: false },
    });

    const triggered = await this.productAlertRepo.count({
      where: { user_id: userId, is_triggered: true },
    });

    return { total_alerts, active_price_drop, active_back_in_stock, triggered };
  }
}
