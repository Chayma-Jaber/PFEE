import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SearchQuery } from '../analytics/entities/search-query.entity';
import { SearchSynonym } from './entities/search-synonym.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SearchQuery, SearchSynonym])],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
