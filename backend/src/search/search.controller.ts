import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

/**
 * Meilisearch-compatible proxy controller.
 *
 * The Angular frontend directly calls Meilisearch endpoints like:
 *   POST /indexes/products/search
 *   GET  /indexes/products/search?filter=...&sort=...
 *   GET  /indexes/categories/42
 *
 * This controller replicates those same routes so the frontend can
 * optionally route through the NestJS backend instead of hitting
 * Meilisearch directly. The global prefix 'api' is excluded for
 * /indexes/* routes (configured in main.ts).
 *
 * @SkipTransform() ensures responses are NOT wrapped in { data, meta }
 * so the frontend receives raw Meilisearch-format responses.
 */
@ApiTags('Search')
@SkipTransform()
@Controller('indexes')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  /**
   * POST /indexes/:indexName/search
   * Meilisearch-compatible search endpoint (body contains search params).
   */
  @Post(':indexName/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search an index (Meilisearch-compatible POST)' })
  @ApiParam({ name: 'indexName', description: 'Meilisearch index name (e.g. products, categories)' })
  async searchPost(
    @Param('indexName') indexName: string,
    @Body()
    body: {
      q?: string;
      filter?: string | string[];
      sort?: string[];
      limit?: number;
      offset?: number;
      attributesToSearchOn?: string[];
      attributesToRetrieve?: string[];
      attributesToHighlight?: string[];
      attributesToCrop?: string[];
      facets?: string[];
      page?: number;
      hitsPerPage?: number;
    },
  ) {
    // Resolve alias (e.g. produits → products)
    const resolvedIndex = this.searchService.resolveIndexName(indexName);
    this.logger.debug(
      `POST search on index "${indexName}"${indexName !== resolvedIndex ? ` (resolved to "${resolvedIndex}")` : ''}: ${JSON.stringify(body)}`,
    );

    try {
      // The service handles sanitization and filter-error fallback internally
      return await this.searchService.search(indexName, body);
    } catch (error) {
      this.logger.error(`Search error on index "${resolvedIndex}": ${error.message}`);
      // Return Meilisearch-compatible empty response so the frontend doesn't crash
      return {
        hits: [],
        query: body.q || '',
        processingTimeMs: 0,
        limit: body.limit ?? 20,
        offset: body.offset ?? 0,
        estimatedTotalHits: 0,
      };
    }
  }

  /**
   * GET /indexes/:indexName/search?q=...&filter=...&sort=...&limit=...&offset=...
   * Meilisearch-compatible search endpoint (query params).
   */
  @Get(':indexName/search')
  @ApiOperation({ summary: 'Search an index (Meilisearch-compatible GET)' })
  @ApiParam({ name: 'indexName', description: 'Meilisearch index name' })
  async searchGet(
    @Param('indexName') indexName: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
    @Query('attributesToRetrieve') attributesToRetrieve?: string,
    @Query('attributesToSearchOn') attributesToSearchOn?: string,
    @Query('facets') facets?: string,
    @Query('page') pageRaw?: string,
    @Query('hitsPerPage') hitsPerPageRaw?: string,
  ) {
    const params: any = {};
    if (q !== undefined && q !== null) params.q = q;
    if (filter) params.filter = filter;
    if (sort) params.sort = sort.split(',');
    if (attributesToRetrieve) params.attributesToRetrieve = attributesToRetrieve.split(',');
    if (attributesToSearchOn) params.attributesToSearchOn = attributesToSearchOn.split(',');
    if (facets) params.facets = facets.split(',');

    // Parse numeric params — let sanitizeParams handle null/NaN/0
    if (limitRaw !== undefined && limitRaw !== null) {
      params.limit = Number(limitRaw) || null;
    }
    if (offsetRaw !== undefined && offsetRaw !== null) {
      params.offset = Number(offsetRaw) || null;
    }
    if (pageRaw !== undefined && pageRaw !== null) {
      params.page = Number(pageRaw) || null;
    }
    if (hitsPerPageRaw !== undefined && hitsPerPageRaw !== null) {
      params.hitsPerPage = Number(hitsPerPageRaw) || null;
    }

    const resolvedIndex = this.searchService.resolveIndexName(indexName);
    this.logger.debug(
      `GET search on index "${indexName}"${indexName !== resolvedIndex ? ` (resolved to "${resolvedIndex}")` : ''}: ${JSON.stringify(params)}`,
    );

    try {
      return await this.searchService.search(indexName, params);
    } catch (error) {
      this.logger.error(`Search error on index "${resolvedIndex}": ${error.message}`);
      return {
        hits: [],
        query: q || '',
        processingTimeMs: 0,
        limit: params.limit || 20,
        offset: params.offset || 0,
        estimatedTotalHits: 0,
      };
    }
  }

  /**
   * GET /indexes/:indexName/documents/:documentId
   * Get a single document by ID from a Meilisearch index.
   * Matches the standard Meilisearch document retrieval endpoint.
   * The frontend uses this for: GET /indexes/categories/documents/42
   */
  @Get(':indexName/documents/:documentId')
  @ApiOperation({ summary: 'Get a document by ID from an index (Meilisearch-compatible)' })
  @ApiParam({ name: 'indexName', description: 'Meilisearch index name' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  async getDocumentMeili(
    @Param('indexName') indexName: string,
    @Param('documentId') documentId: string,
  ) {
    return this.getDocument(indexName, documentId);
  }

  /**
   * GET /indexes/:indexName/:documentId
   * Legacy shorthand for document retrieval (kept for backward compatibility).
   */
  @Get(':indexName/:documentId')
  @ApiOperation({ summary: 'Get a document by ID from an index' })
  @ApiParam({ name: 'indexName', description: 'Meilisearch index name' })
  @ApiParam({ name: 'documentId', description: 'Document ID' })
  async getDocument(
    @Param('indexName') indexName: string,
    @Param('documentId') documentId: string,
  ) {
    const resolvedIndex = this.searchService.resolveIndexName(indexName);
    this.logger.debug(
      `GET document "${documentId}" from index "${indexName}"${indexName !== resolvedIndex ? ` (resolved to "${resolvedIndex}")` : ''}`,
    );

    try {
      // Try numeric ID first, fall back to string
      const id = /^\d+$/.test(documentId) ? Number(documentId) : documentId;
      return await this.searchService.getDocument(indexName, id);
    } catch (error) {
      this.logger.error(
        `Document fetch error on index "${resolvedIndex}", id "${documentId}": ${error.message}`,
      );
      throw new NotFoundException(
        `Document "${documentId}" not found in index "${resolvedIndex}"`,
      );
    }
  }

  /**
   * GET /indexes/health (optional utility)
   */
  @Get('health')
  @ApiOperation({ summary: 'Check Meilisearch health' })
  async health() {
    const healthy = await this.searchService.isHealthy();
    return { status: healthy ? 'available' : 'unavailable' };
  }
}
