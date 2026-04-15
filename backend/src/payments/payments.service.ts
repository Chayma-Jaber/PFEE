import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentMethod, PaymentState } from './entities/payment.entity';
import { PaymentLog } from './entities/payment-log.entity';
import {
  Order,
  OrderStatus,
  PaymentStatus,
} from '../orders/entities/order.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly ctpApiUrl: string;
  private readonly ctpMerchantId: string;
  private readonly ctpApiKey: string;
  private readonly ctpSecretKey: string;
  private readonly ctpSandboxMode: boolean;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly configService: ConfigService,
  ) {
    this.ctpApiUrl = this.configService.get<string>(
      'payment.ctpApiUrl',
      'https://api.sandbox.ctp.tn',
    );
    this.ctpMerchantId = this.configService.get<string>(
      'payment.ctpMerchantId',
      '',
    );
    this.ctpApiKey = this.configService.get<string>('payment.ctpApiKey', '');
    this.ctpSecretKey = this.configService.get<string>(
      'payment.ctpSecretKey',
      '',
    );
    this.ctpSandboxMode = this.configService.get<boolean>(
      'payment.ctpSandboxMode',
      true,
    );
  }

  /**
   * Generate a unique payment reference: PAY-<uuid-short>
   */
  private generatePaymentReference(): string {
    return `PAY-${uuidv4().substring(0, 12).toUpperCase()}`;
  }

  /**
   * Initiate a CTP payment for an order.
   * Creates a Payment record and calls the CTP API to get a redirect URL.
   */
  async initiateCtp(
    orderId: number,
    redirectUrl: string,
    cancelUrl?: string,
    meta?: { ip_address?: string; user_agent?: string },
  ): Promise<{ payment_url: string; payment_id: number; reference: string }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    // Check if there is already a pending/initiated payment
    const existingPayment = await this.paymentRepo.findOne({
      where: {
        order_id: orderId,
        state: PaymentState.INITIATED,
      },
    });

    if (existingPayment && existingPayment.ctp_redirect_url) {
      return {
        payment_url: existingPayment.ctp_redirect_url,
        payment_id: existingPayment.id,
        reference: existingPayment.reference,
      };
    }

    const idempotencyKey = `ctp-${orderId}-${Date.now()}`;
    const paymentRef = this.generatePaymentReference();

    // Create payment record
    const payment = this.paymentRepo.create({
      order_id: orderId,
      reference: paymentRef,
      method: PaymentMethod.CTP,
      state: PaymentState.INITIATED,
      amount: order.total_amount,
      currency: 'TND',
      idempotency_key: idempotencyKey,
      ip_address: meta?.ip_address || null,
      user_agent: meta?.user_agent || null,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Log the initiation
    await this.logPaymentEvent(
      savedPayment.id,
      'INITIATE',
      null,
      PaymentState.INITIATED,
    );

    // Call CTP API
    try {
      const ctpResponse = await this.callCtpCreateTransaction(
        order,
        savedPayment,
        redirectUrl,
        cancelUrl,
      );

      // Update payment with CTP response
      savedPayment.ctp_transaction_id = ctpResponse.transactionId || null;
      savedPayment.ctp_payment_id = ctpResponse.paymentId || null;
      savedPayment.ctp_redirect_url = ctpResponse.paymentUrl || null;
      savedPayment.gateway_response = ctpResponse;
      savedPayment.state = PaymentState.PENDING;
      savedPayment.attempt_count += 1;

      await this.paymentRepo.save(savedPayment);

      // Update order with CTP transaction reference
      order.ctp_transaction_id = ctpResponse.transactionId || null;
      order.payment_reference = paymentRef;
      order.status = OrderStatus.PAYMENT_PENDING;
      await this.orderRepo.save(order);

      await this.logPaymentEvent(
        savedPayment.id,
        'CTP_CREATED',
        PaymentState.INITIATED,
        PaymentState.PENDING,
        ctpResponse.transactionId,
      );

      return {
        payment_url: ctpResponse.paymentUrl || redirectUrl,
        payment_id: savedPayment.id,
        reference: paymentRef,
      };
    } catch (error) {
      savedPayment.state = PaymentState.FAILED;
      savedPayment.error_message = error.message;
      savedPayment.failed_at = new Date();
      await this.paymentRepo.save(savedPayment);

      await this.logPaymentEvent(
        savedPayment.id,
        'CTP_CREATE_FAILED',
        PaymentState.INITIATED,
        PaymentState.FAILED,
        null,
        error.message,
      );

      this.logger.error(
        `CTP initiation failed for order #${orderId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Payment initiation failed. Please try again.',
      );
    }
  }

  /**
   * Verify the status of a CTP payment for an order.
   */
  async verifyCtp(orderId: number): Promise<{
    status: string;
    payment_status: string;
    order_status: string;
    transaction_id?: string;
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    const payment = await this.paymentRepo.findOne({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException(
        `No payment found for order #${orderId}`,
      );
    }

    // If already completed or failed, return current state
    if (
      payment.state === PaymentState.COMPLETED ||
      payment.state === PaymentState.FAILED
    ) {
      return {
        status: payment.state,
        payment_status: order.payment_status,
        order_status: order.status,
        transaction_id: payment.ctp_transaction_id,
      };
    }

    // Query CTP gateway for the latest status
    try {
      const ctpStatus = await this.callCtpCheckTransaction(
        payment.ctp_transaction_id,
      );

      const previousState = payment.state;

      if (ctpStatus.success || ctpStatus.status === 'COMPLETED') {
        payment.state = PaymentState.COMPLETED;
        payment.completed_at = new Date();
        payment.gateway_response = ctpStatus;

        order.payment_status = PaymentStatus.PAID;
        order.status = OrderStatus.CONFIRMED;
        order.confirmed_at = new Date();
      } else if (ctpStatus.status === 'FAILED' || ctpStatus.failed) {
        payment.state = PaymentState.FAILED;
        payment.failed_at = new Date();
        payment.error_code = ctpStatus.errorCode || null;
        payment.error_message = ctpStatus.errorMessage || 'Payment failed';
        payment.gateway_response = ctpStatus;

        order.payment_status = PaymentStatus.FAILED;
        order.status = OrderStatus.FAILED;
      }
      // else: still PENDING, no change

      await this.paymentRepo.save(payment);
      await this.orderRepo.save(order);

      if (previousState !== payment.state) {
        await this.logPaymentEvent(
          payment.id,
          'CTP_VERIFY',
          previousState,
          payment.state,
          ctpStatus.transactionId,
        );
      }
    } catch (error) {
      this.logger.warn(
        `CTP verification call failed for order #${orderId}: ${error.message}`,
      );
      // Don't change state on verification failure - return current state
    }

    return {
      status: payment.state,
      payment_status: order.payment_status,
      order_status: order.status,
      transaction_id: payment.ctp_transaction_id,
    };
  }

  /**
   * Retry a failed CTP payment.
   */
  async retryCtp(
    orderId: number,
    redirectUrl: string,
    meta?: { ip_address?: string; user_agent?: string },
  ): Promise<{ payment_url: string; payment_id: number; reference: string }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    // Mark any existing failed/initiated payments as cancelled
    const existingPayments = await this.paymentRepo.find({
      where: { order_id: orderId },
    });

    for (const p of existingPayments) {
      if (
        p.state === PaymentState.INITIATED ||
        p.state === PaymentState.PENDING ||
        p.state === PaymentState.FAILED
      ) {
        p.state = PaymentState.CANCELLED;
        await this.paymentRepo.save(p);
      }
    }

    // Reset order status for retry
    order.status = OrderStatus.PENDING;
    order.payment_status = PaymentStatus.PENDING;
    await this.orderRepo.save(order);

    // Initiate a new payment
    return this.initiateCtp(orderId, redirectUrl, undefined, meta);
  }

  /**
   * Handle CTP webhook callback.
   * Verifies HMAC-SHA256 signature and updates payment/order status.
   */
  async handleCtpWebhook(
    payload: Record<string, any>,
    signature: string,
  ): Promise<{ received: boolean }> {
    // Verify HMAC signature
    if (this.ctpSecretKey) {
      const expectedSignature = createHmac('sha256', this.ctpSecretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        this.logger.warn('Invalid CTP webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    const transactionId = payload.transactionId || payload.transaction_id;
    const status = payload.status;

    if (!transactionId) {
      this.logger.warn('CTP webhook missing transactionId');
      throw new BadRequestException('Missing transactionId');
    }

    const payment = await this.paymentRepo.findOne({
      where: { ctp_transaction_id: transactionId },
    });

    if (!payment) {
      this.logger.warn(
        `CTP webhook: no payment found for transaction ${transactionId}`,
      );
      return { received: true }; // Acknowledge but no action
    }

    const order = await this.orderRepo.findOne({
      where: { id: payment.order_id },
    });

    const previousState = payment.state;

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      payment.state = PaymentState.COMPLETED;
      payment.completed_at = new Date();
      payment.gateway_response = payload;

      if (order) {
        order.payment_status = PaymentStatus.PAID;
        if (
          order.status === OrderStatus.PENDING ||
          order.status === OrderStatus.PAYMENT_PENDING
        ) {
          order.status = OrderStatus.CONFIRMED;
          order.confirmed_at = new Date();
        }
        await this.orderRepo.save(order);
      }
    } else if (status === 'FAILED' || status === 'REJECTED') {
      payment.state = PaymentState.FAILED;
      payment.failed_at = new Date();
      payment.error_code = payload.errorCode || null;
      payment.error_message = payload.errorMessage || 'Payment failed';
      payment.gateway_response = payload;

      if (order) {
        order.payment_status = PaymentStatus.FAILED;
        order.status = OrderStatus.FAILED;
        await this.orderRepo.save(order);
      }
    } else if (status === 'CANCELLED') {
      payment.state = PaymentState.CANCELLED;
      payment.gateway_response = payload;

      if (order) {
        order.payment_status = PaymentStatus.FAILED;
        order.status = OrderStatus.CANCELLED;
        order.cancelled_at = new Date();
        await this.orderRepo.save(order);
      }
    }

    await this.paymentRepo.save(payment);

    await this.logPaymentEvent(
      payment.id,
      'WEBHOOK',
      previousState,
      payment.state,
      transactionId,
      status,
    );

    this.logger.log(
      `CTP webhook processed: transaction ${transactionId}, status ${status}`,
    );

    return { received: true };
  }

  /**
   * Get available payment methods based on delivery type.
   */
  getPaymentMethods(deliveryType?: string): {
    methods: { id: string; name: string; available: boolean }[];
  } {
    const methods = [
      {
        id: 'CBE',
        name: 'Carte bancaire',
        available: true,
      },
      {
        id: 'COD',
        name: 'Paiement à la livraison',
        available: deliveryType === 'home',
      },
    ];

    return { methods };
  }

  // ==================== CTP API CALLS ====================

  /**
   * Call CTP API to create a payment transaction.
   */
  private async callCtpCreateTransaction(
    order: Order,
    payment: Payment,
    redirectUrl: string,
    cancelUrl?: string,
  ): Promise<Record<string, any>> {
    if (!this.ctpApiKey || !this.ctpMerchantId) {
      // In sandbox/dev mode without credentials, return mock
      if (this.ctpSandboxMode) {
        this.logger.warn(
          'CTP credentials not configured - returning sandbox mock',
        );
        const mockTxId = `SANDBOX-${Date.now()}`;
        return {
          success: true,
          transactionId: mockTxId,
          paymentId: `PID-${mockTxId}`,
          paymentUrl: `${this.ctpApiUrl}/pay/${mockTxId}?redirect=${encodeURIComponent(redirectUrl)}`,
        };
      }
      throw new Error('CTP payment credentials not configured');
    }

    const body = {
      merchantId: this.ctpMerchantId,
      amount: Number(order.total_amount) * 1000, // CTP expects millimes
      currency: 'TND',
      orderId: order.reference,
      description: `Order ${order.reference}`,
      returnUrl: redirectUrl,
      cancelUrl: cancelUrl || redirectUrl,
      customerEmail: order.customer_email || '',
      customerPhone: order.customer_phone || '',
      idempotencyKey: payment.idempotency_key,
    };

    const response = await fetch(`${this.ctpApiUrl}/v1/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.ctpApiKey}`,
        'X-Idempotency-Key': payment.idempotency_key,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CTP API error (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Call CTP API to check transaction status.
   */
  private async callCtpCheckTransaction(
    transactionId: string,
  ): Promise<Record<string, any>> {
    if (!this.ctpApiKey || !this.ctpMerchantId) {
      if (this.ctpSandboxMode) {
        this.logger.warn(
          'CTP credentials not configured - returning sandbox mock status',
        );
        return {
          success: true,
          transactionId,
          status: 'COMPLETED',
        };
      }
      throw new Error('CTP payment credentials not configured');
    }

    const response = await fetch(
      `${this.ctpApiUrl}/v1/payments/status/${transactionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.ctpApiKey}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `CTP API error (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }

  // ==================== HELPERS ====================

  private async logPaymentEvent(
    paymentId: number,
    eventType: string,
    statusBefore: string | null,
    statusAfter: string,
    responseCode?: string,
    responseMessage?: string,
  ): Promise<void> {
    await this.paymentLogRepo.save(
      this.paymentLogRepo.create({
        payment_id: paymentId,
        event_type: eventType,
        status_before: statusBefore,
        status_after: statusAfter,
        response_code: responseCode || null,
        response_message: responseMessage || null,
      }),
    );
  }
}
