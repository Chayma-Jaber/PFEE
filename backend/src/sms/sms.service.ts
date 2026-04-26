import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SmsMessage, SmsPurpose, SmsStatus } from './entities/sms-message.entity';

export interface SendSmsOptions {
  to: string;
  body: string;
  purpose?: SmsPurpose;
  userId?: number | null;
}

interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;
  private readonly provider: 'console' | 'twilio' | 'infobip';
  private readonly from: string;
  private readonly defaultCountryCode: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SmsMessage) private readonly repo: Repository<SmsMessage>,
  ) {
    this.enabled = this.configService.get<boolean>('sms.enabled', false);
    this.provider = this.configService.get<string>('sms.provider', 'console') as any;
    this.from = this.configService.get<string>('sms.fromNumber', 'Barsha');
    this.defaultCountryCode = this.configService.get<string>('sms.defaultCountryCode', '+216');

    if (this.enabled) {
      this.logger.log(`SMS enabled — provider=${this.provider}, from=${this.from}`);
    } else {
      this.logger.log('SMS disabled — messages will log to sms_messages with status=PENDING');
    }
  }

  // Normalize to E.164-ish. Accepts "21612345678", "+21612345678", "12345678" (gets default country prefix).
  normalizePhone(raw: string): string {
    if (!raw) return '';
    let s = raw.trim().replace(/[\s\-().]/g, '');
    if (s.startsWith('+')) return s;
    if (s.startsWith('00')) return '+' + s.slice(2);
    if (s.length > 8) return '+' + s;
    return this.defaultCountryCode + s;
  }

  async sendSms(opts: SendSmsOptions): Promise<SmsMessage> {
    const to = this.normalizePhone(opts.to);
    const body = (opts.body || '').slice(0, 480);
    const purpose = opts.purpose || SmsPurpose.OTHER;

    const row = this.repo.create({
      user_id: opts.userId ?? null,
      to,
      from: this.from,
      body,
      purpose,
      status: SmsStatus.PENDING,
      provider: this.provider,
    });
    const saved = await this.repo.save(row);

    if (!this.enabled) {
      this.logger.debug(`[SMS disabled] would send to ${to}: ${body}`);
      return saved;
    }
    if (!to || to.length < 6) {
      saved.status = SmsStatus.FAILED;
      saved.error_message = 'Invalid phone number';
      await this.repo.save(saved);
      return saved;
    }

    let result: ProviderResult;
    try {
      if (this.provider === 'twilio') result = await this.sendViaTwilio(to, body);
      else if (this.provider === 'infobip') result = await this.sendViaInfobip(to, body);
      else result = await this.sendViaConsole(to, body);
    } catch (err: any) {
      result = { success: false, error: err?.message || 'provider exception' };
    }

    if (result.success) {
      saved.status = SmsStatus.SENT;
      saved.sent_at = new Date();
      saved.provider_message_id = result.providerMessageId || null;
    } else {
      saved.status = SmsStatus.FAILED;
      saved.error_message = (result.error || 'unknown error').slice(0, 500);
    }
    return this.repo.save(saved);
  }

  async sendOtp(phone: string, code: string, userId?: number | null) {
    return this.sendSms({
      to: phone,
      body: `Votre code Barsha: ${code}. Ne le partagez avec personne. Valide 10 min.`,
      purpose: SmsPurpose.OTP,
      userId,
    });
  }

  async sendOrderConfirmation(phone: string, orderRef: string, userId?: number | null) {
    return this.sendSms({
      to: phone,
      body: `Barsha — Commande ${orderRef} confirmée ! Nous vous tiendrons informé du suivi.`,
      purpose: SmsPurpose.ORDER,
      userId,
    });
  }

  async sendShippingUpdate(phone: string, orderRef: string, tracking: string, userId?: number | null) {
    return this.sendSms({
      to: phone,
      body: `Barsha — Votre colis ${orderRef} est en route. Suivi: ${tracking}`,
      purpose: SmsPurpose.SHIPPING,
      userId,
    });
  }

  private async sendViaConsole(to: string, body: string): Promise<ProviderResult> {
    this.logger.log(`[SMS/console] to=${to} body="${body}"`);
    return { success: true, providerMessageId: `console-${Date.now()}` };
  }

  private async sendViaTwilio(to: string, body: string): Promise<ProviderResult> {
    const sid = this.configService.get<string>('sms.twilioAccountSid', '');
    const token = this.configService.get<string>('sms.twilioAuthToken', '');
    if (!sid || !token) return { success: false, error: 'Twilio credentials missing' };
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const basic = Buffer.from(`${sid}:${token}`).toString('base64');
    const form = new URLSearchParams();
    form.set('To', to);
    form.set('From', this.from);
    form.set('Body', body);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data?.message || `Twilio HTTP ${res.status}` };
      }
      return { success: true, providerMessageId: data?.sid };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Twilio error' };
    }
  }

  private async sendViaInfobip(to: string, body: string): Promise<ProviderResult> {
    const base = this.configService.get<string>('sms.infobipBaseUrl', '');
    const apiKey = this.configService.get<string>('sms.infobipApiKey', '');
    if (!base || !apiKey) return { success: false, error: 'Infobip credentials missing' };
    const url = `${base.replace(/\/$/, '')}/sms/2/text/advanced`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [{ from: this.from, destinations: [{ to }], text: body }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.requestError?.serviceException?.text || `Infobip HTTP ${res.status}`;
        return { success: false, error: msg };
      }
      const msgId = data?.messages?.[0]?.messageId;
      return { success: true, providerMessageId: msgId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Infobip error' };
    }
  }
}
