import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagEvent } from './entities/flag-event.entity';

export interface FlagDecision {
  enabled: boolean;
  variant: string; // 'on' / 'off' for boolean flags, or A/B name
  reason: string;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  // Tiny in-process cache so the per-request evaluate doesn't hit DB every time.
  private cache: Map<string, { row: FeatureFlag; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(FeatureFlag) private readonly flagRepo: Repository<FeatureFlag>,
    @InjectRepository(FeatureFlagEvent) private readonly evRepo: Repository<FeatureFlagEvent>,
  ) {}

  // Deterministic bucket: same user+flag → same bucket on every call. Hash keeps it fair.
  private bucket(userKey: string, flagKey: string): number {
    const h = createHash('sha256').update(`${userKey}:${flagKey}`).digest();
    // Take first 4 bytes as uint32, mod 100
    return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0 % 100;
  }

  private async load(key: string): Promise<FeatureFlag | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.row;
    const row = await this.flagRepo.findOne({ where: { key } });
    if (row) this.cache.set(key, { row, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return row || null;
  }

  invalidateCache(key?: string) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }

  async evaluate(key: string, userId: number | null = null, segments: string[] = []): Promise<FlagDecision> {
    const flag = await this.load(key);
    if (!flag) return { enabled: false, variant: 'off', reason: 'flag_not_found' };
    if (!flag.is_enabled) return { enabled: false, variant: 'off', reason: 'globally_disabled' };

    // Segment gate
    if (Array.isArray(flag.segments) && flag.segments.length > 0) {
      const allowed = segments.some((s) => flag.segments!.includes(s));
      if (!allowed) return { enabled: false, variant: 'off', reason: 'segment_excluded' };
    }

    // Rollout bucketing
    const userKey = userId ? `u:${userId}` : `anon:${Math.random()}`;
    const bucket = this.bucket(userKey, flag.key);

    if (Array.isArray(flag.variants) && flag.variants.length > 0) {
      // Multi-arm test: pick variant by cumulative weight
      const totalWeight = flag.variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
      if (totalWeight <= 0) return { enabled: false, variant: 'off', reason: 'invalid_variants' };
      const roll = bucket % 100; // 0..99
      let cum = 0;
      for (const v of flag.variants) {
        cum += (v.weight / totalWeight) * 100;
        if (roll < cum) return { enabled: true, variant: v.name, reason: 'variant_assigned' };
      }
      return { enabled: true, variant: flag.variants[flag.variants.length - 1].name, reason: 'fallback_variant' };
    }

    // Boolean flag with rollout pct
    const inRollout = bucket % 100 < (flag.rollout_pct ?? 100);
    return {
      enabled: inRollout,
      variant: inRollout ? 'on' : 'off',
      reason: inRollout ? 'in_rollout' : 'out_of_rollout',
    };
  }

  // Lightweight wrapper that callers can use without awaiting if they just want a cached read.
  async isEnabled(key: string, userId: number | null = null): Promise<boolean> {
    const d = await this.evaluate(key, userId);
    return d.enabled;
  }

  // Recording exposures + conversions. Best-effort, never blocks request.
  async recordExposure(key: string, variant: string, userId: number | null) {
    try {
      await this.evRepo.save(this.evRepo.create({ flag_key: key, user_id: userId, variant, kind: 'EXPOSURE', goal: null }));
    } catch {}
  }

  async recordConversion(key: string, variant: string, userId: number | null, goal: string, metadata?: any) {
    try {
      await this.evRepo.save(this.evRepo.create({ flag_key: key, user_id: userId, variant, kind: 'CONVERSION', goal, metadata: metadata || null }));
    } catch {}
  }

  // ═══ Admin CRUD ═══════════════════════════════════════════════════════

  list() { return this.flagRepo.find({ order: { id: 'DESC' } }); }

  async upsert(data: Partial<FeatureFlag>) {
    if (!data.key || !data.name) throw new BadRequestException('key + name requis');
    let row = await this.flagRepo.findOne({ where: { key: data.key } });
    if (!row) row = this.flagRepo.create({
      key: data.key,
      name: data.name,
      description: data.description || null,
      is_enabled: data.is_enabled === true,
      rollout_pct: data.rollout_pct ?? 100,
      segments: data.segments || null,
      variants: data.variants || null,
    });
    else Object.assign(row, data);
    const saved = await this.flagRepo.save(row);
    this.invalidateCache(saved.key);
    return saved;
  }

  async toggle(id: number) {
    const f = await this.flagRepo.findOne({ where: { id } });
    if (!f) throw new NotFoundException();
    f.is_enabled = !f.is_enabled;
    const saved = await this.flagRepo.save(f);
    this.invalidateCache(saved.key);
    return saved;
  }

  async delete(id: number) {
    const f = await this.flagRepo.findOne({ where: { id } });
    if (f) this.invalidateCache(f.key);
    await this.flagRepo.delete({ id });
    return { success: true };
  }

  // Conversion math: per-variant exposure + conversion counts → rate per goal
  async results(key: string, goal?: string) {
    const exposures = await this.evRepo
      .createQueryBuilder('e')
      .select('e.variant', 'variant')
      .addSelect('COUNT(1)', 'exposures')
      .where('e.flag_key = :k', { k: key })
      .andWhere("e.kind = 'EXPOSURE'")
      .groupBy('e.variant')
      .getRawMany();

    const convQB = this.evRepo
      .createQueryBuilder('e')
      .select('e.variant', 'variant')
      .addSelect('COUNT(1)', 'conversions')
      .where('e.flag_key = :k', { k: key })
      .andWhere("e.kind = 'CONVERSION'");
    if (goal) convQB.andWhere('e.goal = :g', { g: goal });
    const conversions = await convQB.groupBy('e.variant').getRawMany();

    const map = new Map<string, { variant: string; exposures: number; conversions: number; rate: number }>();
    for (const e of exposures) map.set(e.variant, { variant: e.variant, exposures: Number(e.exposures), conversions: 0, rate: 0 });
    for (const c of conversions) {
      const row = map.get(c.variant) || { variant: c.variant, exposures: 0, conversions: 0, rate: 0 };
      row.conversions = Number(c.conversions);
      map.set(c.variant, row);
    }
    return [...map.values()].map((r) => ({
      ...r,
      rate: r.exposures > 0 ? Math.round((r.conversions / r.exposures) * 1000) / 10 : 0,
    }));
  }
}
