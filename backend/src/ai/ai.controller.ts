import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { AiService } from './ai.service';
import {
  ChatRequestDto,
  ChatResponseDto,
  VisualSearchRequestDto,
  VisualSearchResponseDto,
} from './dto/ai.dto';

@ApiTags('AI')
@SkipTransform()
@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with AI shopping assistant (Qwen/Ollama primary)' })
  @ApiResponse({ status: 200, description: 'AI response with optional product matches', type: ChatResponseDto })
  async chat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user?: any,
  ): Promise<ChatResponseDto> {
    const userContext = dto.user_context || {};
    if (user?.first_name) {
      userContext.user_name = userContext.user_name || user.first_name;
    }

    const result = await this.aiService.chat(dto.messages, userContext);
    return {
      text: result.text,
      products: result.products,
    };
  }

  @Post('visual-search')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Visual search using image' })
  @ApiResponse({ status: 200, description: 'Matched products by visual similarity', type: VisualSearchResponseDto })
  async visualSearch(
    @Body() dto: VisualSearchRequestDto,
  ): Promise<VisualSearchResponseDto> {
    const image = dto.image || dto.image_base64;
    return this.aiService.visualSearch(image);
  }

  @Post('like-this')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Find products visually similar to uploaded image (legacy)' })
  @ApiResponse({ status: 200, description: 'Matched products by visual similarity' })
  async likeThis(
    @Body() dto: VisualSearchRequestDto,
  ) {
    const image = dto.image || dto.image_base64;
    return this.aiService.likeThis(image, dto.image_url);
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check AI services health' })
  async health() {
    return this.aiService.getHealth();
  }
}
