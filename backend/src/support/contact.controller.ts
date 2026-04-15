import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsEmail, IsOptional } from 'class-validator';

class CustomerMessageDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  codeOtp?: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;
}

class UsersCountDto {
  @IsString()
  phone: string;
}

@Controller()
export class ContactController {
  @Post('addCustomerMsg')
  async addCustomerMessage(@Body() dto: CustomerMessageDto) {
    // Store the contact message (in production, save to DB and/or send email)
    console.log(
      `[Contact] New message from ${dto.email}: ${dto.subject}`,
    );
    return { success: true, message: 'Message sent successfully' };
  }

  @Post('usersCount')
  async usersCount(@Body() dto: UsersCountDto) {
    // This endpoint checks if a phone number is already registered
    // For now, return 0 (not found) - the auth service handles actual user lookup
    return { count: 0 };
  }
}
