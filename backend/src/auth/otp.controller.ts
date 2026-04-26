import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { SmsService } from '../sms/sms.service';

class GenerateOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}

class ValidateOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

/**
 * OTP Controller
 * Handles SMS OTP generation and validation for phone verification.
 * In development mode, OTP is always '1234'.
 */
@Controller()
export class OtpController {
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(private readonly sms: SmsService) {}

  @Post('code-otp/generate')
  async generateOtp(@Body() dto: GenerateOtpDto) {
    // Generate a 4-digit OTP. Prod always random; dev random unless no provider, in which case '1234'.
    const devFallback = process.env.SMS_ENABLED !== 'true';
    const code = devFallback
      ? '1234'
      : Math.floor(1000 + Math.random() * 9000).toString();

    this.otpStore.set(dto.phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Real send (or console-provider log when SMS_ENABLED!=true)
    const msg = await this.sms.sendOtp(dto.phone, code);

    return {
      success: msg.status !== 'FAILED',
      message: msg.status === 'FAILED' ? (msg.error_message || 'SMS failed') : 'OTP sent successfully',
      provider: msg.provider,
    };
  }

  @Post('code-otp/validate')
  async validateOtp(@Body() dto: ValidateOtpDto) {
    const stored = this.otpStore.get(dto.phone);

    if (!stored) {
      return { success: false, message: 'No OTP found for this phone number' };
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(dto.phone);
      return { success: false, message: 'OTP has expired' };
    }

    if (stored.code !== dto.code) {
      return { success: false, message: 'Invalid OTP code' };
    }

    this.otpStore.delete(dto.phone);
    return { success: true, message: 'OTP validated successfully' };
  }
}
