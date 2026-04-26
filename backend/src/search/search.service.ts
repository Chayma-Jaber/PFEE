import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeiliSearch, Index } from 'meilisearch';
import { SearchQuery } from '../analytics/entities/search-query.entity';
import { SearchSynonym } from './entities/search-synonym.entity';

/**
 * Map of legacy / alternate index names to the real Meilisearch index name.
 * Add entries here whenever the frontend uses an alias that doesn't match
 * the actual Meilisearch index.
 */
const INDEX_ALIASES: Record<string, string> = {
  produits: 'products',
  produit: 'products',
  categorie: 'categories',
  categories_fr: 'categories',
};

/**
 * Fields that are known to NOT be filterable in the default Meilisearch
 * configuration. If a filter references one of these, we strip it out
 * rather than letting Meilisearch reject the whole request.
 */
const NON_FILTERABLE_FIELDS = [
  'active',
  'disponible',
  'featuredInSearch',
  'featured',
  'visible',
];

/**
 * Fields that are known to NOT be sortable in the default Meilisearch
 * configuration. If a sort references one of these, we strip it out
 * rather than letting Meilisearch reject the whole request.
 */
const NON_SORTABLE_FIELDS = [
  'id',
  'discountValue',
  'dateActivation',
  'title',
  'nom',
];

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectRepository(SearchQuery)
    private readonly searchQueryRepo?: Repository<SearchQuery>,
    @Optional()
    @InjectRepository(SearchSynonym)
    private readonly synonymRepo?: Repository<SearchSynonym>,
  ) {}

  /** Expand query with synonyms. Used by Meilisearch as space-separated alternatives. */
  async expandQuery(q: string): Promise<string> {
    if (!q || !q.trim() || !this.synonymRepo) return q;
    try {
      const qLower = q.toLowerCase();
      const synonyms = await this.synonymRepo.find({ where: { is_active: true } });
      const extras: string[] = [];
      for (const s of synonyms) {
        if (qLower.includes(s.term)) {
          (s.synonyms || []).forEach((alt) => { if (!qLower.includes(alt)) extras.push(alt); });
        }
      }
      if (extras.length === 0) return q;
      // Meilisearch's default is AND-tokens; append alternatives to broaden match.
      return q + ' ' + extras.slice(0, 5).join(' ');
    } catch {
      return q;
    }
  }

  /** Fire-and-forget analytics write. Never throws. */
  private async trackQuery(query: string, resultCount: number, indexName: string): Promise<void> {
    if (!this.searchQueryRepo) return;
    try {
      await this.searchQueryRepo.save(
        this.searchQueryRepo.create({
          query: query.substring(0, 255),
          result_count: resultCount,
          index_name: indexName,
          user_id: null,
        }),
      );
    } catch {
      // ignore
    }
  }

  async onModuleInit() {
    const host = this.configService.get<string>('meilisearch.url', 'http://localhost:7700');
    const apiKey = this.configService.get<string>('meilisearch.token', '');

    if (!apiKey) {
      this.logger.warn(
        'MEILISEARCH_TOKEN is empty — search requests will likely fail with 403. ' +
        'Set the MEILISEARCH_TOKEN environment variable.',
      );
    }

    this.client = new MeiliSearch({ host, apiKey });
    this.logger.log(`Meilisearch client configured for: ${host}`);

    // Test the connection on startup so failures are immediately visible
    try {
      const health = await this.client.health();
      this.logger.log(`Meilisearch connection OK (status: ${health.status})`);

      // Log available indexes for debugging
      const { results: indexes } = await this.client.getIndexes();
      const indexNames = indexes.map((idx) => idx.uid);
      this.logger.log(`Meilisearch indexes available: [${indexNames.join(', ')}]`);
    } catch (error: any) {
      this.logger.error(
        `Meilisearch connection FAILED at ${host}: ${error.message}. ` +
        'Search will return empty results until the connection is restored.',
      );
    }
  }

  // ─── Index name resolution ──────────────────────────────────────────

  /**
   * Resolve an index name through the alias map.
   * Returns the real Meilisearch index name.
   */
  resolveIndexName(indexName: string): string {
    const lower = indexName.toLowerCase();
    return INDEX_ALIASES[lower] ?? indexName;
  }

  /**
   * Get a Meilisearch index by name (alias-aware).
   */
  getIndex(indexName: string): Index {
    return this.client.index(this.resolveIndexName(indexName));
  }

  // ─── Parameter sanitization ─────────────────────────────────────────

  /**
   * Sanitize search parameters before forwarding to Meilisearch.
   * - Ensures limit is a positive integer (default 20)
   * - Ensures offset is a non-negative integer (default 0)
   * - Strips filters that reference non-filterable fields
   */
  sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized = { ...params };

    // limit: must be a positive integer
    if (
      sanitized.limit === null ||
      sanitized.limit === undefined ||
      sanitized.limit === 0 ||
      Number.isNaN(Number(sanitized.limit))
    ) {
      sanitized.limit = 20;
    } else {
      sanitized.limit = Math.max(1, Math.floor(Number(sanitized.limit)));
    }

    // offset: must be a non-negative integer
    if (
      sanitized.offset === null ||
      sanitized.offset === undefined ||
      Number.isNaN(Number(sanitized.offset))
    ) {
      sanitized.offset = 0;
    } else {
      sanitized.offset = Math.max(0, Math.floor(Number(sanitized.offset)));
    }

    // hitsPerPage: if present, must be a positive integer
    if (sanitized.hitsPerPage !== undefined) {
      if (
        sanitized.hitsPerPage === null ||
        sanitized.hitsPerPage === 0 ||
        Number.isNaN(Number(sanitized.hitsPerPage))
      ) {
        sanitized.hitsPerPage = 20;
      } else {
        sanitized.hitsPerPage = Math.max(1, Math.floor(Number(sanitized.hitsPerPage)));
      }
    }

    // page: if present, must be a positive integer
    if (sanitized.page !== undefined) {
      if (
        sanitized.page === null ||
        sanitized.page === 0 ||
        Number.isNaN(Number(sanitized.page))
      ) {
        sanitized.page = 1;
      } else {
        sanitized.page = Math.max(1, Math.floor(Number(sanitized.page)));
      }
    }

    // Strip known non-filterable fields from filters
    if (sanitized.filter) {
      sanitized.filter = this.stripNonFilterableFields(sanitized.filter);
    }

    // Strip sort attributes that are known to not be sortable
    if (sanitized.sort && Array.isArray(sanitized.sort)) {
      sanitized.sort = sanitized.sort.filter((s: string) => {
        const field = s.split(':')[0];
        return !NON_SORTABLE_FIELDS.includes(field);
      });
      if (sanitized.sort.length === 0) delete sanitized.sort;
    }

    return sanitized;
  }

  /**
   * Remove filter clauses that reference non-filterable fields.
   * Handles both string filters and array filters.
   */
  private stripNonFilterableFields(
    filter: string | string[] | string[][],
  ): string | string[] | string[][] | undefined {
    if (Array.isArray(filter)) {
      // Array of strings or array of arrays
      const cleaned = (filter as any[])
        .map((f) =>
          Array.isArray(f)
            ? f.filter((clause: string) => !this.mentionsNonFilterable(clause))
            : this.mentionsNonFilterable(f)
              ? null
              : f,
        )
        .filter((f) => f !== null && !(Array.isArray(f) && f.length === 0));
      return cleaned.length > 0 ? (cleaned as string[] | string[][]) : undefined;
    }

    if (typeof filter === 'string') {
      // Split on AND, keep clauses that don't reference non-filterable fields,
      // then re-join. This is a best-effort approach for simple filters.
      const clauses = filter.split(/\s+AND\s+/i);
      const kept = clauses.filter((c) => !this.mentionsNonFilterable(c));
      return kept.length > 0 ? kept.join(' AND ') : undefined;
    }

    return filter;
  }

  private mentionsNonFilterable(clause: string): boolean {
    const lower = clause.toLowerCase().trim();
    return NON_FILTERABLE_FIELDS.some((field) => lower.startsWith(field.toLowerCase()));
  }

  // ─── Core search (with filter-error fallback) ───────────────────────

  /**
   * Generic search on any index - returns Meilisearch-compatible response.
   * This is the core method used by the controller to proxy requests.
   *
   * If Meilisearch rejects a filter (attribute not filterable), we retry
   * the search without the filter so the frontend still gets results.
   */
  async search(
    indexName: string,
    params: {
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
  ): Promise<any> {
    const resolved = this.resolveIndexName(indexName);
    const index = this.client.index(resolved);
    const { q, ...rest } = params;
    const sanitized = this.sanitizeParams(rest);

    const expandedQuery = await this.expandQuery(q || '');
    try {
      const result = await index.search(expandedQuery, sanitized);
      this.logger.debug(
        `Search on "${resolved}" returned ${result.hits?.length ?? 0} hits ` +
        `(estimated total: ${result.estimatedTotalHits ?? result.totalHits ?? '?'})`,
      );
      // Fire-and-forget analytics tracking for product searches with a real query
      if ((q || '').trim() && (resolved === 'products')) {
        this.trackQuery(q!.trim(), result.hits?.length ?? 0, resolved).catch(() => {});
      }
      return result;
    } catch (error: any) {
      const msg: string = error?.message || error?.toString() || '';
      const code: string = error?.code || error?.httpStatus || '';

      // Use WARN instead of ERROR for known recoverable issues (sort/filter rejections)
      const isFilterError =
        msg.includes('is not filterable') ||
        msg.includes('not filterable') ||
        msg.includes('invalid filter');
      const isSortError =
        msg.includes('is not sortable') ||
        msg.includes('not sortable') ||
        msg.includes('invalid sort');

      if (isFilterError || isSortError) {
        this.logger.warn(
          `Meilisearch search error on index "${resolved}" [${code}]: ${msg}`,
        );
      } else {
        this.logger.error(
          `Meilisearch search error on index "${resolved}" [${code}]: ${msg}`,
        );
      }

      // If the error is about a non-filterable attribute, retry without filter
      if (isFilterError) {
        this.logger.warn(
          `Filter rejected on "${resolved}": ${msg}. Retrying without filter.`,
        );
        const { filter, ...withoutFilter } = sanitized;
        try {
          return await index.search(q || '', withoutFilter);
        } catch (retryError: any) {
          this.logger.error(
            `Retry without filter also failed on "${resolved}": ${retryError.message}`,
          );
        }
      }

      // If the error is about a non-sortable attribute, retry without sort
      if (isSortError) {
        this.logger.debug(
          `Sort rejected on "${resolved}": ${msg}. Retrying without sort.`,
        );
        const { sort, ...withoutSort } = sanitized;
        try {
          return await index.search(q || '', withoutSort);
        } catch (retryError: any) {
          this.logger.error(
            `Retry without sort also failed on "${resolved}": ${retryError.message}`,
          );
        }
      }

      // Last resort: retry with only q and limit (strip filter + sort)
      this.logger.warn(
        `Search failed on "${resolved}": ${msg}. Final retry with q + limit only.`,
      );
      try {
        const limit = sanitized.limit || 20;
        const offset = sanitized.offset || 0;
        return await index.search(q || '', { limit, offset });
      } catch (finalError: any) {
        this.logger.error(
          `All retries failed on "${resolved}": ${finalError.message}`,
        );
        // Return empty Meilisearch-compatible response instead of throwing
        return {
          hits: [],
          query: q || '',
          processingTimeMs: 0,
          limit: sanitized.limit || 20,
          offset: sanitized.offset || 0,
          estimatedTotalHits: 0,
        };
      }
    }
  }

  /**
   * Search products using Meilisearch.
   * Accepts Meilisearch-compatible search params and returns the raw response.
   */
  async searchProducts(
    query?: string,
    filters?: string,
    sort?: string[],
    limit?: number,
    offset?: number,
    attributesToSearchOn?: string[],
    facets?: string[],
  ): Promise<any> {
    return this.search('products', {
      q: query,
      filter: filters,
      sort,
      limit,
      offset,
      attributesToSearchOn,
      facets,
    });
  }

  /**
   * Search categories using Meilisearch.
   */
  async searchCategories(
    query?: string,
    filters?: string,
    sort?: string[],
    limit?: number,
    offset?: number,
  ): Promise<any> {
    return this.search('categories', {
      q: query,
      filter: filters,
      sort,
      limit,
      offset,
    });
  }

  /**
   * Get a single document from an index by its ID (alias-aware).
   */
  async getDocument(indexName: string, documentId: string | number): Promise<Record<string, any>> {
    const resolved = this.resolveIndexName(indexName);
    const index = this.client.index(resolved);
    this.logger.debug(`Fetching document "${documentId}" from index "${resolved}"`);

    // Try direct document lookup first
    try {
      return await index.getDocument(documentId);
    } catch (error: any) {
      this.logger.debug(
        `Direct document fetch failed for "${documentId}" in "${resolved}": ${error.message}. Trying search fallback.`,
      );
    }

    // Fallback: search with ID filter
    try {
      const result = await index.search('', {
        filter: `id = ${documentId}`,
        limit: 1,
      });
      if (result.hits && result.hits.length > 0) {
        return result.hits[0];
      }
    } catch (searchError: any) {
      this.logger.debug(`Search fallback with id filter failed: ${searchError.message}. Trying without filter.`);
    }

    // Final fallback: search with the ID as query text
    try {
      const result = await index.search(String(documentId), { limit: 1 });
      if (result.hits && result.hits.length > 0) {
        return result.hits[0];
      }
    } catch (finalError: any) {
      this.logger.error(`All document fetch methods failed for "${documentId}" in "${resolved}"`);
    }

    throw new Error(`Document "${documentId}" not found in index "${resolved}"`);
  }

  /**
   * Get multiple documents from an index.
   */
  async getDocuments(
    indexName: string,
    params?: { limit?: number; offset?: number; fields?: string[] },
  ): Promise<any> {
    const index = this.getIndex(indexName);
    return index.getDocuments(params);
  }

  /**
   * Health check for the Meilisearch instance.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.status === 'available';
    } catch {
      return false;
    }
  }
}
