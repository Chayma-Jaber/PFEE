import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // In-memory store for password reset codes (use Redis in production)
  private resetCodes = new Map<string, { userId: number; expiresAt: Date }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await this.validatePassword(
      dto.password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async register(dto: RegisterDto) {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
    });

    const tokens = await this.generateTokens(user);
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: number, dto: UpdateUserDto) {
    const user = await this.usersService.update(userId, dto);
    return this.sanitizeUser(user);
  }

  async deleteAccount(userId: number) {
    await this.usersService.delete(userId);
    return { message: 'Account deleted successfully' };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentValid = await this.validatePassword(
      dto.current_password,
      user.password_hash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await this.hashPassword(dto.new_password);
    await this.usersService.update(userId, {} as any);
    // Directly update password_hash since it's not in UpdateUserDto
    user.password_hash = newHash;
    await this.usersService['userRepository'].save(user);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      // Don't reveal if phone exists or not
      return { message: 'If the phone number is registered, a reset code has been sent' };
    }

    // Store the OTP code for verification during reset
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    this.resetCodes.set(dto.codeOtp, {
      userId: user.id,
      expiresAt,
    });

    this.logger.log(`Password reset code generated for user ${user.id}`);

    return { message: 'If the phone number is registered, a reset code has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Passwords do not match');
    }

    const resetData = this.resetCodes.get(dto.code);
    if (!resetData) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    if (new Date() > resetData.expiresAt) {
      this.resetCodes.delete(dto.code);
      throw new BadRequestException('Reset code has expired');
    }

    const user = await this.usersService.findById(resetData.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newHash = await this.hashPassword(dto.password);
    user.password_hash = newHash;
    await this.usersService['userRepository'].save(user);

    // Remove used code
    this.resetCodes.delete(dto.code);

    return { message: 'Password reset successfully' };
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessTokenExpireMinutes = this.configService.get<number>(
      'jwt.accessTokenExpireMinutes',
      1440,
    );
    const refreshTokenExpireDays = this.configService.get<number>(
      'jwt.refreshTokenExpireDays',
      7,
    );

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: `${accessTokenExpireMinutes}m`,
      }),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        { expiresIn: `${refreshTokenExpireDays}d` },
      ),
    ]);

    return { access_token, refresh_token };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Account is deactivated');
      }

      const tokens = await this.generateTokens(user);
      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validatePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private sanitizeUser(user: User) {
    const { password_hash, ...result } = user;
    return result;
  }
}
