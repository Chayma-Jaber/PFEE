import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import {
  InitiateCtpDto,
  LegacyGenerateCtpDto,
  LegacyCheckCtpDto,
} from './dto/initiate-payment.dto';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ==================== NEW ENDPOINTS ====================

  @Post('payment/ctp/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate CTP payment for an order' })
  async initiateCtp(
    @Body() dto: InitiateCtpDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.initiateCtp(
      dto.order_id,
      dto.redirect_url,
      dto.cancel_url,
      {
        ip_address: req.ip || (req.headers['x-forwarded-for'] as string),
        user_agent: req.headers['user-agent'],
      },
    );
  }

  @Get('payment/ctp/verify/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify CTP payment status' })
  async verifyCtp(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.verifyCtp(orderId);
  }

  @Post('payment/ctp/retry/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retry failed CTP payment' })
  async retryCtp(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('redirect_url') redirectUrl: string,
    @Req() req: Request,
  ) {
    return this.paymentsService.retryCtp(orderId, redirectUrl, {
      ip_address: req.ip || (req.headers['x-forwarded-for'] as string),
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('payment/webhook/ctp')
  @ApiOperation({ summary: 'CTP webhook callback (no auth, signature verified)' })
  async ctpWebhook(
    @Body() payload: Record<string, any>,
    @Headers('x-ctp-signature') signature: string,
  ) {
    return this.paymentsService.handleCtpWebhook(payload, signature);
  }

  @Get('payment/methods')
  @ApiOperation({ summary: 'Get available payment methods' })
  async getPaymentMethods(@Query('delivery_type') deliveryType?: string) {
    return this.paymentsService.getPaymentMethods(deliveryType);
  }

  // ==================== LEGACY COMPATIBILITY ENDPOINTS ====================

  @Post('generateCTPTransaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: Generate CTP transaction' })
  async generateCTPTransaction(
    @Body() dto: LegacyGenerateCtpDto,
    @Req() req: Request,
  ) {
    const result = await this.paymentsService.initiateCtp(
      dto.orderId,
      dto.redirectTo,
      undefined,
      {
        ip_address: req.ip || (req.headers['x-forwarded-for'] as string),
        user_agent: req.headers['user-agent'],
      },
    );
    return {
      paymentUrl: result.payment_url,
      transactionId: result.reference,
    };
  }

  @Post('checkCTPTransaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: Check CTP transaction status' })
  async checkCTPTransaction(@Body() dto: LegacyCheckCtpDto) {
    return this.paymentsService.verifyCtp(dto.orderId);
  }
}
