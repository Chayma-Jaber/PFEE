import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailLog, EmailLogKind, EmailLogStatus } from './entities/email-log.entity';

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

  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>,
  ) {
    this.enabled = this.configService.get<boolean>('email.enabled', true);
    this.fromEmail = this.configService.get<string>('email.fromEmail', 'noreply@barsha.com.tn');
    this.fromName = this.configService.get<string>('email.fromName', 'Barsha');
    this.frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:4200');
    this.appUrl = this.configService.get<string>('app.url', 'http://localhost:8000');

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
    meta?: { kind?: EmailLogKind; userId?: number | null },
  ): Promise<boolean> {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    const trackingId = randomUUID().replace(/-/g, '').slice(0, 32);
    const kind = meta?.kind || EmailLogKind.OTHER;

    // Persist the attempt first (QUEUED) so partial failures leave an audit trail.
    let logRow: EmailLog | null = null;
    try {
      logRow = this.logRepo.create({
        tracking_id: trackingId,
        recipient: recipients.slice(0, 255),
        subject: subject.slice(0, 400),
        kind,
        status: this.enabled ? EmailLogStatus.QUEUED : EmailLogStatus.DISABLED,
        user_id: meta?.userId ?? null,
      });
      logRow = await this.logRepo.save(logRow);
    } catch (err) {
      this.logger.warn(`email_log insert failed: ${(err as any)?.message || err}`);
    }

    if (!this.enabled) {
      this.logger.debug(`Email disabled. Would send to ${recipients}: ${subject}`);
      return false;
    }

    // Inject a 1×1 open-tracking pixel at end of <body> (or HTML if no <body>)
    const pixel = `<img src="${this.appUrl}/api/email-tracking/pixel/${trackingId}.png" alt="" width="1" height="1" style="display:none;" />`;
    const instrumentedHtml = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${pixel}</body>`)
      : html + pixel;

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: recipients,
        subject,
        html: instrumentedHtml,
        text: text || subject,
        headers: { 'X-Barsha-Tracking': trackingId },
      });

      this.logger.log(`Email sent to ${recipients}: ${info.messageId}`);
      if (logRow) {
        logRow.status = EmailLogStatus.SENT;
        logRow.sent_at = new Date();
        logRow.provider_message_id = info?.messageId || null;
        try { await this.logRepo.save(logRow); } catch {}
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${recipients}: ${error.message}`,
        error.stack,
      );
      if (logRow) {
        logRow.status = EmailLogStatus.FAILED;
        logRow.error_message = String(error?.message || error).slice(0, 500);
        try { await this.logRepo.save(logRow); } catch {}
      }
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
      { kind: EmailLogKind.ORDER_CONFIRMATION },
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
      { kind: EmailLogKind.PAYMENT_CONFIRMATION },
    );
  }

  // Backwards-compatible signature: trackingNumber as the 2nd positional arg still
  // works. New callers pass an options object instead with carrier + URL + items so
  // the rendered email gets a proper tracking CTA button.
  async sendShippingNotification(
    order: OrderEmailData,
    trackingOrOpts: string | { trackingNumber: string; carrier?: string; trackingUrl?: string; itemTitle?: string } = '',
  ): Promise<boolean> {
    const opts = typeof trackingOrOpts === 'string'
      ? { trackingNumber: trackingOrOpts }
      : trackingOrOpts;
    const trackingNumber = (opts.trackingNumber || '').trim();
    const carrier = (opts.carrier || '').trim();
    const trackingUrl = (opts.trackingUrl || '').trim();
    const itemTitle = (opts.itemTitle || '').trim();
    const orderRef = order.orderNumber || `#${order.id}`;
    // Prefer the explicit carrier URL when the seller filled it in. Fall back to the
    // customer's order page on barsha — never leave the CTA dead.
    const ctaHref = trackingUrl || `${this.frontendUrl}/account/orders/${order.id}`;
    const ctaLabel = trackingUrl ? 'Suivre mon colis' : 'Voir ma commande';
    // Item-aware subject when the caller is a per-line seller fulfillment.
    const subject = itemTitle
      ? `Barsha — "${itemTitle}" expédié (cmd ${orderRef})${trackingNumber ? ` — Suivi ${trackingNumber}` : ''}`
      : `Barsha — Cmd ${orderRef} expédiée${trackingNumber ? ` — Suivi ${trackingNumber}` : ''}`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fafafa;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#2d2d4d);color:#fff;padding:24px 20px;text-align:center;">
          <h1 style="margin:0;font-size:24px;letter-spacing:0.5px;">Barsha</h1>
          <p style="margin:6px 0 0;font-size:13px;opacity:.8;">Votre commande est en route</p>
        </div>
        <div style="background:#fff;padding:28px 26px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${itemTitle ? '📦 Votre article est expédié !' : '📦 Votre commande est expédiée !'}</h2>
          <p style="color:#374151;line-height:1.6;margin:0 0 14px;">Bonjour ${order.customerName || 'cher client'},</p>
          <p style="color:#374151;line-height:1.6;margin:0 0 18px;">
            ${itemTitle
              ? `L'article <strong>${itemTitle}</strong> de votre commande <strong>${orderRef}</strong> vient d'être expédié.`
              : `Votre commande <strong>${orderRef}</strong> vient d'être expédiée.`}
          </p>
          ${trackingNumber ? `
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px 18px;margin:0 0 18px;">
            <div style="font-size:12px;color:#4f46e5;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Suivi</div>
            <div style="font-size:18px;font-weight:700;color:#111827;margin-top:4px;letter-spacing:0.5px;">${trackingNumber}</div>
            ${carrier ? `<div style="font-size:13px;color:#4b5563;margin-top:2px;">Transporteur : <strong>${carrier}</strong></div>` : ''}
          </div>` : ''}
          <div style="text-align:center;margin:24px 0 12px;">
            <a href="${ctaHref}"
               style="display:inline-block;background:linear-gradient(135deg,#6366f1,#ec4899);color:#fff;
                      padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;
                      box-shadow:0 4px 12px rgba(99,102,241,.3);">
              ${ctaLabel} →
            </a>
          </div>
          ${!trackingUrl ? `<p style="text-align:center;color:#6b7280;font-size:12px;margin:8px 0 0;">
            Vous pouvez aussi suivre l'évolution depuis votre espace compte.
          </p>` : ''}
          ${order.shippingAddress ? `<p style="margin:24px 0 0;color:#4b5563;font-size:13px;line-height:1.6;border-top:1px solid #f3f4f6;padding-top:18px;"><strong>Livraison à :</strong> ${order.shippingAddress}</p>` : ''}
        </div>
        <div style="background:#f5f5f5;padding:14px;text-align:center;font-size:11px;color:#9ca3af;">
          <p style="margin:0;">© Barsha — Tous droits réservés</p>
          <p style="margin:4px 0 0;">Cet email a été envoyé suite à votre commande sur barsha.com.tn</p>
        </div>
      </div>
    `;

    const text = itemTitle
      ? `Bonjour ${order.customerName || 'cher client'},\n\nL'article "${itemTitle}" de votre commande ${orderRef} est expédié.${trackingNumber ? `\nNuméro de suivi : ${trackingNumber}` : ''}${carrier ? ` (${carrier})` : ''}\n\nSuivre : ${ctaHref}\n\n— Barsha`
      : `Bonjour ${order.customerName || 'cher client'},\n\nVotre commande ${orderRef} est expédiée.${trackingNumber ? `\nNuméro de suivi : ${trackingNumber}` : ''}${carrier ? ` (${carrier})` : ''}\n\nSuivre : ${ctaHref}\n\n— Barsha`;

    return this.sendMail(
      order.customerEmail,
      subject,
      html,
      text,
      { kind: EmailLogKind.SHIPPING },
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
      { kind: EmailLogKind.PASSWORD_RESET },
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
      { kind: EmailLogKind.SUPPORT },
    );
  }

  async sendCartRecovery(
    email: string,
    customerName: string | undefined,
    couponCode: string,
    discountPercent: number,
    expiresAt: Date,
  ): Promise<boolean> {
    const cartUrl = `${this.frontendUrl}/tn/panier`;
    const expDate = expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:24px;text-align:center;">
          <h1 style="margin:0;">Barsha</h1>
        </div>
        <div style="padding:30px 20px;">
          <h2 style="color:#1a1a2e;">Votre panier vous attend !</h2>
          <p>Bonjour ${customerName || 'cher(e) client(e)'},</p>
          <p>Vous avez laissé des articles dans votre panier. Pour vous remercier, voici un code promo exclusif :</p>
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:24px;border-radius:10px;margin:20px 0;text-align:center;">
            <p style="margin:0;font-size:14px;opacity:0.9;">CODE PROMO — -${discountPercent}%</p>
            <p style="font-size:36px;font-weight:800;letter-spacing:3px;margin:8px 0;">${couponCode}</p>
            <p style="margin:0;font-size:12px;opacity:0.9;">Valable jusqu'au ${expDate}</p>
          </div>
          <p style="text-align:center;margin:30px 0;">
            <a href="${cartUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;">Finaliser ma commande</a>
          </p>
          <p style="color:#888;font-size:13px;text-align:center;">Ce code est à usage unique et expire dans 7 jours.</p>
        </div>
        <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#888;">
          <p>&copy; Barsha - Tunisie</p>
        </div>
      </div>
    `;
    return this.sendMail(
      email,
      `Votre panier + un code -${discountPercent}% offert`,
      html,
      `Code promo ${couponCode} (-${discountPercent}%) valable jusqu'au ${expDate}. Votre panier: ${cartUrl}`,
      { kind: EmailLogKind.CART_RECOVERY },
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
          this.sendMail(email, content.subject, html, content.textBody, { kind: EmailLogKind.NEWSLETTER }),
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
