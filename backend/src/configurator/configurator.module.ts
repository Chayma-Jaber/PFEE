import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configurator } from './entities/configurator.entity';
import { ConfiguratorSlot } from './entities/configurator-slot.entity';
import { Product } from '../products/entities/product.entity';
import { ConfiguratorService } from './configurator.service';
import { ConfiguratorStorefrontController, ConfiguratorAdminController } from './configurator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Configurator, ConfiguratorSlot, Product])],
  controllers: [ConfiguratorStorefrontController, ConfiguratorAdminController],
  providers: [ConfiguratorService],
  exports: [ConfiguratorService],
})
export class ConfiguratorModule {}
