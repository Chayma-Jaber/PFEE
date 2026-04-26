import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CmsPage, CmsPageStatus } from './entities/cms-page.entity';
import { CmsRevision } from './entities/cms-revision.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(
    @InjectRepository(CmsPage) private readonly pageRepo: Repository<CmsPage>,
    @InjectRepository(CmsRevision) private readonly revRepo: Repository<CmsRevision>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // ═══ Public read — used by the storefront ═════════════════════════════

  async getPublishedBySlug(slug: string, locale = 'fr'): Promise<CmsPage | null> {
    const now = new Date();
    const page = await this.pageRepo.findOne({ where: { slug, locale } });
    if (!page) return null;
    if (page.status !== CmsPageStatus.PUBLISHED && page.status !== CmsPageStatus.SCHEDULED) return null;
    if (page.status === CmsPageStatus.SCHEDULED) {
      if (!page.publish_at || page.publish_at.getTime() > now.getTime()) return null;
    }
    if (page.unpublish_at && page.unpublish_at.getTime() <= now.getTime()) return null;
    return page;
  }

  listPublished(locale = 'fr') {
    return this.pageRepo.find({ where: { locale, status: CmsPageStatus.PUBLISHED }, order: { updated_at: 'DESC' } });
  }

  // ═══ Admin CRUD + revisions ═══════════════════════════════════════════

  listAll(opts: { locale?: string; status?: string } = {}) {
    const qb = this.pageRepo.createQueryBuilder('p').orderBy('p.updated_at', 'DESC');
    if (opts.locale) qb.andWhere('p.locale = :l', { l: opts.locale });
    if (opts.status) qb.andWhere('p.status = :s', { s: opts.status.toUpperCase() });
    return qb.getMany();
  }

  async getById(id: number) {
    const p = await this.pageRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }

  async create(adminId: number, data: Partial<CmsPage>) {
    if (!data.slug || !data.title) throw new Error('slug + title requis');
    const p = this.pageRepo.create({
      slug: data.slug,
      title: data.title,
      meta_description: data.meta_description || null,
      cover_image: data.cover_image || null,
      locale: data.locale || 'fr',
      blocks: data.blocks || [],
      status: data.status || CmsPageStatus.DRAFT,
      publish_at: data.publish_at || null,
      unpublish_at: data.unpublish_at || null,
      version: 1,
      created_by: adminId,
      updated_by: adminId,
    });
    const saved = await this.pageRepo.save(p);
    await this.recordRevision(saved, adminId, 'created');
    return saved;
  }

  async update(adminId: number, id: number, patch: Partial<CmsPage>, changeNote?: string) {
    const p = await this.pageRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    Object.assign(p, patch, { updated_by: adminId, version: p.version + 1 });
    const saved = await this.pageRepo.save(p);
    await this.recordRevision(saved, adminId, changeNote);
    return saved;
  }

  async publish(adminId: number, id: number) {
    return this.update(adminId, id, { status: CmsPageStatus.PUBLISHED }, 'published');
  }

  async unpublish(adminId: number, id: number) {
    return this.update(adminId, id, { status: CmsPageStatus.DRAFT }, 'unpublished');
  }

  async listRevisions(pageId: number) {
    return this.revRepo.find({ where: { page_id: pageId }, order: { version: 'DESC' } });
  }

  async revert(adminId: number, pageId: number, version: number) {
    const rev = await this.revRepo.findOne({ where: { page_id: pageId, version } });
    if (!rev) throw new NotFoundException();
    return this.update(adminId, pageId, rev.snapshot as any, `reverted to v${version}`);
  }

  // Strip inactive/missing product IDs from every product-list block on this page,
  // bump the version, and write a revision tagged "cleanup" so it's auditable + revertible.
  // Returns the count of references removed and the updated blocks.
  async cleanupInactiveReferences(adminId: number, pageId: number) {
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page) throw new NotFoundException();

    const audit = await this.checkInactiveReferences(pageId);
    if (audit.problematic.length === 0) {
      return { removed: 0, message: 'Aucune référence à nettoyer' };
    }

    // Set of (blockIndex, productId) pairs to drop — keyed as "idx:pid" strings
    const toRemove = new Set(audit.problematic.map((p) => `${p.blockIndex}:${p.productId}`));

    const cleanedBlocks = (page.blocks || []).map((b: any, idx: number) => {
      if (b?.type !== 'product-list' || !Array.isArray(b?.props?.productIds)) return b;
      const filtered = b.props.productIds.filter((pid: any) => !toRemove.has(`${idx}:${pid}`));
      return { ...b, props: { ...b.props, productIds: filtered } };
    });

    page.blocks = cleanedBlocks;
    page.version = page.version + 1;
    (page as any).updated_by = adminId;
    const saved = await this.pageRepo.save(page);
    await this.recordRevision(saved, adminId, `cleanup: removed ${audit.problematic.length} inactive/missing reference(s)`);

    return { removed: audit.problematic.length, message: `${audit.problematic.length} référence(s) supprimée(s)` };
  }

  // Scan a page's blocks for product-list productIds, look them up in the products
  // table, and report any that are missing or inactive. The CMS storefront renderer
  // silently drops these — admin needs explicit warning before publishing.
  async checkInactiveReferences(pageId: number) {
    const page = await this.pageRepo.findOne({ where: { id: pageId } });
    if (!page) throw new NotFoundException();

    const referencedIds = new Set<number>();
    const blockRefs: Array<{ blockIndex: number; blockType: string; productIds: number[] }> = [];

    (page.blocks || []).forEach((b: any, idx: number) => {
      if (b?.type !== 'product-list' || !Array.isArray(b?.props?.productIds)) return;
      const ids = b.props.productIds.filter((x: any) => Number.isInteger(x) && x > 0);
      if (ids.length === 0) return;
      blockRefs.push({ blockIndex: idx, blockType: b.type, productIds: ids });
      ids.forEach((id: number) => referencedIds.add(id));
    });

    if (referencedIds.size === 0) {
      return { totalReferences: 0, missingCount: 0, inactiveCount: 0, problematic: [], blockRefs };
    }

    // Single query for all referenced products
    const found = await this.productRepo.find({ where: { id: In([...referencedIds]) } });
    const foundMap = new Map(found.map((p) => [p.id, p]));

    // Per block: missing (id not in DB) + inactive (in DB, isActive=false)
    const problematic: Array<{ blockIndex: number; productId: number; status: 'MISSING' | 'INACTIVE'; title?: string }> = [];
    for (const ref of blockRefs) {
      for (const id of ref.productIds) {
        const p = foundMap.get(id);
        if (!p) problematic.push({ blockIndex: ref.blockIndex, productId: id, status: 'MISSING' });
        else if (!p.isActive) problematic.push({ blockIndex: ref.blockIndex, productId: id, status: 'INACTIVE', title: p.title });
      }
    }

    return {
      totalReferences: referencedIds.size,
      missingCount: problematic.filter((x) => x.status === 'MISSING').length,
      inactiveCount: problematic.filter((x) => x.status === 'INACTIVE').length,
      problematic,
      blockRefs,
    };
  }

  private async recordRevision(p: CmsPage, adminId: number, note?: string) {
    try {
      await this.revRepo.save(this.revRepo.create({
        page_id: p.id,
        version: p.version,
        snapshot: {
          slug: p.slug, title: p.title, meta_description: p.meta_description,
          cover_image: p.cover_image, locale: p.locale, blocks: p.blocks, status: p.status,
        },
        edited_by: adminId,
        change_note: note?.slice(0, 400) || null,
      }));
    } catch (err) { this.logger.warn(`recordRevision failed: ${(err as any)?.message}`); }
  }
}
