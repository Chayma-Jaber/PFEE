import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEvent } from './entities/domain-event.entity';
import { EventBusService } from './event-bus.service';
import { EventsAdminController } from './events.controller';

// Global so every module can inject EventBusService without explicit imports.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DomainEvent])],
  controllers: [EventsAdminController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
