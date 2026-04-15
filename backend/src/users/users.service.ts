import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, CreateAddressDto, UpdateAddressDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      password_hash: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone,
      gender: dto.gender,
      birth_date: dto.birth_date,
      role: dto.role,
      avatar_url: dto.avatar_url,
      is_active: dto.is_active,
      is_verified: dto.is_verified,
    });

    return this.userRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async delete(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.userRepository.update(id, { last_login: new Date() });
  }

  async countUsers(phone: string): Promise<number> {
    return this.userRepository.count({ where: { phone } });
  }

  // ---- Address Management ----

  async getAddresses(userId: number): Promise<Address[]> {
    return this.addressRepository.find({
      where: { user_id: userId },
      order: { is_default: 'DESC', created_at: 'DESC' },
    });
  }

  async createAddress(userId: number, dto: CreateAddressDto): Promise<Address> {
    // If this is set as default, unset other defaults first
    if (dto.is_default) {
      await this.addressRepository.update(
        { user_id: userId },
        { is_default: false },
      );
    }

    const address = this.addressRepository.create({
      ...dto,
      user_id: userId,
    });

    return this.addressRepository.save(address);
  }

  async updateAddress(id: number, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults first
    if (dto.is_default) {
      await this.addressRepository.update(
        { user_id: address.user_id },
        { is_default: false },
      );
    }

    Object.assign(address, dto);
    return this.addressRepository.save(address);
  }

  async deleteAddress(id: number): Promise<void> {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    await this.addressRepository.remove(address);
  }

  async setDefaultAddress(userId: number, addressId: number): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, user_id: userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Unset all defaults for this user
    await this.addressRepository.update(
      { user_id: userId },
      { is_default: false },
    );

    // Set the chosen address as default
    address.is_default = true;
    return this.addressRepository.save(address);
  }
}
