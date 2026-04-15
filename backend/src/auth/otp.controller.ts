import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

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

  @Post('code-otp/generate')
  async generateOtp(@Body() dto: GenerateOtpDto) {
    // Generate a 4-digit OTP (in production, send via SMS provider)
    const code =
      process.env.NODE_ENV === 'production'
        ? Math.floor(1000 + Math.random() * 9000).toString()
        : '1234';

    this.otpStore.set(dto.phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    // In production, integrate with SMS provider (e.g., Twilio, Vonage)
    console.log(`[OTP] Generated code ${code} for ${dto.phone}`);

    return { success: true, message: 'OTP sent successfully' };
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
