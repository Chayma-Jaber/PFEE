import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface OrderEmailData {
  id: number | string;
  orderNumber?: string;
  customerEmail: string;
  customerName?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount?: number;
  shippingAddress?: string;
  status?: string;
}

interface PaymentEmailData {
  id: number | string;
  orderId: number | string;
  customerEmail: string;
  customerName?: string;
  amount: number;
  method?: string;
  transactionId?: string;
}

interface SupportTicketEmailData {
  id: number | string;
  customerEmail: string;
  customerName?: string;
  subject: string;
  status: string;
  latestResponse?: string;
}

interface NewsletterContent {
  subject: string;
  htmlBody: string;
  textBody?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly enabled: boolean;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('email.enabled', true);
    this.fromEmail = this.configService.get<string>('email.fromEmail', 'noreply@barsha.com.tn');
    this.fromName = this.configService.get<string>('email.fromName', 'Barsha');
    this.frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:4200');

    if (this.enabled) {
      this.createTransporter();
    }
  }

  private createTransporter(): void {
    const host = this.configService.get<string>('email.smtpHost', 'localhost');
    const port = this.configService.get<number>('email.smtpPort', 587);
    const user = this.configService.get<string>('email.smtpUser', '');
    const pass = this.configService.get<string>('email.smtpPassword', '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth:
        user && pass
          ? { user, pass }
          : undefined,
    });

    this.transporter.verify().then(
      () => this.logger.log('SMTP connection established'),
      (err) => this.logger.warn(`SMTP connection failed: ${err.message}. Emails will be logged only.`),
    );
  }

  private async sendMail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
  ): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(`Email disabled. Would send to ${to}: ${subject}`);
      return false;
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: recipients,
        subject,
        html,
        text: text || subject,
      });

      this.logger.log(`Email sent to ${recipients}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${recipients}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async sendOrderConfirmation(order: OrderEmailData): Promise<boolean> {
    const orderRef = order.orderNumber || `#${order.id}`;
    const itemsHtml = (order.items || [])
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${item.price.toFixed(2)} TND</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          <h2>Order Confirmation ${orderRef}</h2>
          <p>Hello ${order.customerName || 'Customer'},</p>
          <p>Thank you for your order! Here is your order summary:</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Product</th>
                <th style="padding:8px;text-align:center;">Qty</th>
                <th style="padding:8px;text-align:right;">Price</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${order.totalAmount ? `<p style="font-size:18px;text-align:right;"><strong>Total: ${order.totalAmount.toFixed(2)} TND</strong></p>` : ''}
          ${order.shippingAddress ? `<p><strong>Shipping to:</strong> ${order.shippingAddress}</p>` : ''}
          <p>You can track your order <a href="${this.frontendUrl}/orders/${order.id}">here</a>.</p>
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
        </div>
      </div>
    `;

    return this.sendMail(
      order.customerEmail,
      `Barsha - Order Confirmation ${orderRef}`,
      html,
      `Your order ${orderRef} has been confirmed. Total: ${order.totalAmount?.toFixed(2) || 'N/A'} TND`,
    );
  }

  async sendPaymentConfirmation(payment: PaymentEmailData): Promise<boolean> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          <h2>Payment Confirmation</h2>
          <p>Hello ${payment.customerName || 'Customer'},</p>
          <p>Your payment has been processed successfully.</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;"><strong>Order:</strong></td><td style="padding:8px;">#${payment.orderId}</td></tr>
            <tr><td style="padding:8px;"><strong>Amount:</strong></td><td style="padding:8px;">${payment.amount.toFixed(2)} TND</td></tr>
            <tr><td style="padding:8px;"><strong>Method:</strong></td><td style="padding:8px;">${payment.method || 'N/A'}</td></tr>
            ${payment.transactionId ? `<tr><td style="padding:8px;"><strong>Transaction ID:</strong></td><td style="padding:8px;">${payment.transactionId}</td></tr>` : ''}
          </table>
          <p>Thank you for shopping with Barsha!</p>
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
        </div>
      </div>
    `;

    return this.sendMail(
      payment.customerEmail,
      `Barsha - Payment Confirmation for Order #${payment.orderId}`,
      html,
      `Payment of ${payment.amount.toFixed(2)} TND confirmed for order #${payment.orderId}.`,
    );
  }

  async sendShippingNotification(
    order: OrderEmailData,
    trackingNumber: string,
  ): Promise<boolean> {
    const orderRef = order.orderNumber || `#${order.id}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          <h2>Your Order Has Been Shipped!</h2>
          <p>Hello ${order.customerName || 'Customer'},</p>
          <p>Great news! Your order ${orderRef} has been shipped.</p>
          <div style="background:#f0f8ff;padding:15px;border-radius:8px;margin:15px 0;">
            <p style="margin:0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
          </div>
          ${order.shippingAddress ? `<p><strong>Delivering to:</strong> ${order.shippingAddress}</p>` : ''}
          <p>Track your order <a href="${this.frontendUrl}/orders/${order.id}">here</a>.</p>
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
        </div>
      </div>
    `;

    return this.sendMail(
      order.customerEmail,
      `Barsha - Order ${orderRef} Shipped - Tracking: ${trackingNumber}`,
      html,
      `Your order ${orderRef} has been shipped. Tracking number: ${trackingNumber}`,
    );
  }

  async sendPasswordReset(email: string, code: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?code=${code}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          <h2>Password Reset Request</h2>
          <p>You have requested to reset your password. Use the code below or click the link:</p>
          <div style="background:#f0f8ff;padding:20px;border-radius:8px;margin:15px 0;text-align:center;">
            <p style="font-size:32px;font-weight:bold;letter-spacing:4px;margin:0;">${code}</p>
          </div>
          <p style="text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 30px;border-radius:5px;text-decoration:none;">Reset Password</a>
          </p>
          <p style="color:#888;font-size:12px;">This code expires in 15 minutes. If you did not request this, ignore this email.</p>
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
        </div>
      </div>
    `;

    return this.sendMail(
      email,
      'Barsha - Password Reset Code',
      html,
      `Your password reset code is: ${code}. This code expires in 15 minutes.`,
    );
  }

  async sendSupportTicketUpdate(
    ticket: SupportTicketEmailData,
  ): Promise<boolean> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          <h2>Support Ticket Update</h2>
          <p>Hello ${ticket.customerName || 'Customer'},</p>
          <p>Your support ticket has been updated:</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;"><strong>Ticket:</strong></td><td style="padding:8px;">#${ticket.id}</td></tr>
            <tr><td style="padding:8px;"><strong>Subject:</strong></td><td style="padding:8px;">${ticket.subject}</td></tr>
            <tr><td style="padding:8px;"><strong>Status:</strong></td><td style="padding:8px;">${ticket.status}</td></tr>
          </table>
          ${
            ticket.latestResponse
              ? `<div style="background:#f9f9f9;padding:15px;border-left:3px solid #1a1a2e;margin:15px 0;">
                  <p style="margin:0;"><strong>Response:</strong></p>
                  <p style="margin:5px 0 0;">${ticket.latestResponse}</p>
                </div>`
              : ''
          }
          <p>View your ticket <a href="${this.frontendUrl}/support/tickets/${ticket.id}">here</a>.</p>
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
        </div>
      </div>
    `;

    return this.sendMail(
      ticket.customerEmail,
      `Barsha - Support Ticket #${ticket.id} Updated`,
      html,
      `Your support ticket #${ticket.id} (${ticket.subject}) status: ${ticket.status}`,
    );
  }

  async sendNewsletter(
    recipients: string[],
    content: NewsletterContent,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:20px;">
          ${content.htmlBody}
        </div>
        <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - All rights reserved</p>
          <p><a href="${this.frontendUrl}/newsletter/unsubscribe">Unsubscribe</a></p>
        </div>
      </div>
    `;

    // Send in batches of 50 to avoid overwhelming the SMTP server
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((email) =>
          this.sendMail(email, content.subject, html, content.textBody),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    this.logger.log(
      `Newsletter "${content.subject}" sent: ${sent} success, ${failed} failed out of ${recipients.length}`,
    );

    return { sent, failed };
  }
}
