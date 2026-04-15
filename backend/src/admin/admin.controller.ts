import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { AdminService } from './admin.service';
import { DashboardPeriod } from './dto/dashboard.dto';
import {
  UpdateOrderStatusDto,
  CreateShipmentDto,
  ProcessRefundDto,
} from './dto/admin-orders.dto';
import {
  AdminUpdateCustomerDto,
  AdminCustomerNoteDto,
} from './dto/admin-customers.dto';
import {
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/admin-coupons.dto';
import {
  ApproveReturnDto,
  RejectReturnDto,
} from './dto/admin-returns.dto';
import {
  CreateBannerDto,
  UpdateBannerDto,
} from './dto/admin-content.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Health ─────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Admin health check' })
  health() {
    return { admin: 'available' };
  }

  // ─── Dashboard ──────────────────────────────────────────────────────

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard KPI stats' })
  @ApiQuery({ name: 'period', enum: DashboardPeriod, required: false })
  getDashboardStats(
    @Query('period') period?: DashboardPeriod,
  ) {
    return this.adminService.getDashboardStats(period || DashboardPeriod.MONTH);
  }

  @Get('dashboard/recent-orders')
  @ApiOperation({ summary: 'Get recent orders for dashboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentOrders(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getRecentOrders(limit);
  }

  @Get('dashboard/low-stock-alerts')
  @ApiOperation({ summary: 'Get low stock product alerts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLowStockAlerts(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getLowStockAlerts(limit);
  }

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Get revenue chart data' })
  @ApiQuery({ name: 'period', enum: DashboardPeriod, required: false })
  getRevenueChartData(
    @Query('period') period?: DashboardPeriod,
  ) {
    return this.adminService.getRevenueChartData(period || DashboardPeriod.MONTH);
  }

  @Get('dashboard/customers')
  @ApiOperation({ summary: 'Get customer metrics for dashboard' })
  @ApiQuery({ name: 'period', enum: DashboardPeriod, required: false })
  getCustomerMetrics(
    @Query('period') period?: DashboardPeriod,
  ) {
    return this.adminService.getCustomerMetrics(period || DashboardPeriod.MONTH);
  }

  // ─── Orders ─────────────────────────────────────────────────────────

  @Get('orders')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'List all orders (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort_by', required: false, type: String })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['ASC', 'DESC'] })
  getAdminOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.adminService.getAdminOrders(page, limit, status, search, sortBy, sortOrder);
  }

  @Get('orders/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Get order details' })
  @ApiParam({ name: 'id', type: Number })
  getAdminOrder(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminOrder(id);
  }

  @Post('orders/:id/status')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', type: Number })
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateOrderStatus(id, dto, adminId);
  }

  @Post('orders/:id/shipment')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Create shipment for order' })
  @ApiParam({ name: 'id', type: Number })
  createShipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateShipmentDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.createShipment(id, dto, adminId);
  }

  @Post('orders/:id/refund')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Process refund for order' })
  @ApiParam({ name: 'id', type: Number })
  processRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRefundDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.processRefund(id, dto, adminId);
  }

  // ─── Products ───────────────────────────────────────────────────────

  @Get('products')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'List products (paginated, searchable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'famille', required: false, type: String })
  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @ApiQuery({ name: 'sort_by', required: false, type: String })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['ASC', 'DESC'] })
  getAdminProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('famille') famille?: string,
    @Query('category_id') categoryId?: number,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.adminService.getAdminProducts(
      page, limit, search, famille, categoryId ? Number(categoryId) : undefined, sortBy, sortOrder,
    );
  }

  @Post('products')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'Create a new product' })
  createProduct(
    @Body() dto: any,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.createProduct(dto, adminId);
  }

  @Patch('products/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', type: Number })
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateProduct(id, dto, adminId);
  }

  @Delete('products/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'Delete (deactivate) a product' })
  @ApiParam({ name: 'id', type: Number })
  deleteProduct(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.deleteProduct(id, adminId);
  }

  @Post('products/:id/images')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'Upload product images (multipart)' })
  @ApiParam({ name: 'id', type: Number })
  @UseInterceptors(FilesInterceptor('images', 10))
  uploadProductImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') adminId: number,
  ) {
    return {
      product_id: id,
      uploaded: (files || []).map((f) => ({
        filename: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
      })),
      message: 'Images received. Process via media service for storage.',
    };
  }

  @Patch('products/:id/inventory')
  @Roles('SUPER_ADMIN', 'ADMIN', 'CATALOG_MANAGER')
  @ApiOperation({ summary: 'Update product inventory / stock' })
  @ApiParam({ name: 'id', type: Number })
  updateProductInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { variants: Array<{ id: number; stock: number }> },
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateProductInventory(id, body.variants, adminId);
  }

  // ─── Customers ──────────────────────────────────────────────────────

  @Get('customers')
  @ApiOperation({ summary: 'List customers (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sort_by', required: false, type: String })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['ASC', 'DESC'] })
  getAdminCustomers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.adminService.getAdminCustomers(page, limit, search, sortBy, sortOrder);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer details' })
  @ApiParam({ name: 'id', type: Number })
  getAdminCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminCustomer(id);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Edit customer' })
  @ApiParam({ name: 'id', type: Number })
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateCustomerDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateCustomer(id, dto, adminId);
  }

  @Post('customers/:id/notes')
  @ApiOperation({ summary: 'Add admin note to customer' })
  @ApiParam({ name: 'id', type: Number })
  addCustomerNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminCustomerNoteDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.addCustomerNote(id, dto.note, adminId);
  }

  // ─── Coupons ────────────────────────────────────────────────────────

  @Get('coupons')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'List coupons' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  getAdminCoupons(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAdminCoupons(page, limit, search);
  }

  @Post('coupons')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Create a new coupon' })
  createCoupon(
    @Body() dto: CreateCouponDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.createCoupon(dto, adminId);
  }

  @Patch('coupons/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiParam({ name: 'id', type: Number })
  updateCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateCoupon(id, dto, adminId);
  }

  @Delete('coupons/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Delete a coupon' })
  @ApiParam({ name: 'id', type: Number })
  deleteCoupon(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.deleteCoupon(id, adminId);
  }

  // ─── Returns ────────────────────────────────────────────────────────

  @Get('returns')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'List return requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  getAdminReturns(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAdminReturns(page, limit, status);
  }

  @Get('returns/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Get return request details' })
  @ApiParam({ name: 'id', type: Number })
  getAdminReturn(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAdminReturn(id);
  }

  @Patch('returns/:id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Approve a return request' })
  @ApiParam({ name: 'id', type: Number })
  approveReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReturnDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.approveReturn(id, dto.admin_note, dto.refund_amount, adminId);
  }

  @Patch('returns/:id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER')
  @ApiOperation({ summary: 'Reject a return request' })
  @ApiParam({ name: 'id', type: Number })
  rejectReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectReturnDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.rejectReturn(id, dto.reason, adminId);
  }

  // ─── Content: Banners ───────────────────────────────────────────────

  @Get('content/banners')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'List all banners' })
  getBanners() {
    return this.adminService.getBanners();
  }

  @Post('content/banners')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Create a banner' })
  createBanner(
    @Body() dto: CreateBannerDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.createBanner(dto, adminId);
  }

  @Patch('content/banners/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Update a banner' })
  @ApiParam({ name: 'id', type: Number })
  updateBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBannerDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.updateBanner(id, dto, adminId);
  }

  @Delete('content/banners/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MARKETING_MANAGER')
  @ApiOperation({ summary: 'Delete a banner' })
  @ApiParam({ name: 'id', type: Number })
  deleteBanner(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
  ) {
    return this.adminService.deleteBanner(id, adminId);
  }
}
