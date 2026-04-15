import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqSearchDto, FaqFeaturedDto } from './dto/faq-query.dto';

@Controller('help')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get('categories')
  async getCategories() {
    return this.faqService.getCategories();
  }

  @Get('category/:slug')
  async getFaqsByCategory(@Param('slug') slug: string) {
    return this.faqService.getFaqsByCategory(slug);
  }

  @Get('featured')
  async getFeatured(@Query() query: FaqFeaturedDto) {
    return this.faqService.getFeatured(query.limit);
  }

  @Get('search')
  async search(@Query() query: FaqSearchDto) {
    return this.faqService.search(query.q);
  }

  @Get('faq/:id')
  async getFaqById(@Param('id', ParseIntPipe) id: number) {
    return this.faqService.findById(id);
  }
}
