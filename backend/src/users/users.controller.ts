import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/update-user.dto';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('getAddresses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async getAddresses(@CurrentUser('id') userId: number) {
    return this.usersService.getAddresses(userId);
  }

  @Post('createAddress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async createAddress(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(userId, dto);
  }

  @Put('updateAddress/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(id, dto);
  }

  @Delete('deleteAddress/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async deleteAddress(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteAddress(id);
  }

  @Put('setDefaultAddress/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async setDefaultAddress(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.setDefaultAddress(userId, id);
  }
}
