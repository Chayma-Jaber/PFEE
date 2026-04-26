import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SizeProfile } from './entities/size-profile.entity';
import { SizeChart } from './entities/size-chart.entity';
import { Product } from '../products/entities/product.entity';

export interface SizeRecommendation {
  recommendedSize: string | null;
  confidence: number; // 0..1
  alternatives: Array<{ size: string; confidence: number }>;
  reason: string;
  usedMeasurements: string[];
  fallback: boolean;
}

function midpoint(min: number | null, max: number | null): number | null {
  if (min == null && max == null) return null;
  if (min == null) return max;
  if (max == null) return min;
  return (min + max) / 2;
}

@Injectable()
export class SizingService {
  private readonly logger = new Logger(SizingService.name);

  constructor(
    @InjectRepository(SizeProfile) private readonly profileRepo: Repository<SizeProfile>,
    @InjectRepository(SizeChart) private readonly chartRepo: Repository<SizeChart>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // ═══ User profile ══════════════════════════════════════════════════════

  async getProfile(userId: number): Promise<SizeProfile | null> {
    return this.profileRepo.findOne({ where: { user_id: userId } });
  }

  async upsertProfile(userId: number, patch: Partial<SizeProfile>): Promise<SizeProfile> {
    let p = await this.profileRepo.findOne({ where: { user_id: userId } });
    if (!p) p = this.profileRepo.create({ user_id: userId, fit_preference: 'REGULAR' });
    const numericFields = ['height', 'weight', 'chest', 'waist', 'hips', 'shoulder_width', 'inseam', 'shoe_size_eu'];
    for (const f of numericFields) {
      if ((patch as any)[f] !== undefined) (p as any)[f] = (patch as any)[f] == null ? null : Number((patch as any)[f]);
    }
    if (patch.fit_preference) p.fit_preference = patch.fit_preference;
    if (patch.usual_size_top !== undefined) p.usual_size_top = patch.usual_size_top;
    if (patch.usual_size_bottom !== undefined) p.usual_size_bottom = patch.usual_size_bottom;

    // Auto-infer usual sizes from measurements if not overridden
    if (!p.usual_size_top && p.chest) p.usual_size_top = this.inferTopSizeFromChest(p.chest);
    if (!p.usual_size_bottom && p.waist) p.usual_size_bottom = this.inferBottomSizeFromWaist(p.waist);

    return this.profileRepo.save(p);
  }

  private inferTopSizeFromChest(chest: number): string {
    if (chest < 84) return 'XS';
    if (chest < 92) return 'S';
    if (chest < 100) return 'M';
    if (chest < 108) return 'L';
    if (chest < 116) return 'XL';
    return 'XXL';
  }

  private inferBottomSizeFromWaist(waist: number): string {
    if (waist < 66) return 'XS';
    if (waist < 74) return 'S';
    if (waist < 82) return 'M';
    if (waist < 90) return 'L';
    if (waist < 98) return 'XL';
    return 'XXL';
  }

  // ═══ Recommendation ════════════════════════════════════════════════════

  async recommendForProduct(userId: number, productId: number): Promise<SizeRecommendation> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const profile = await this.getProfile(userId);
    const category = this.deriveCategory(product);
    const brand = this.deriveBrand(product);

    const charts = await this.chartRepo.find({
      where: { brand, category },
      order: { size_label: 'ASC' },
    });

    if (charts.length === 0) {
      // Fallback: use profile's usual size if we have one
      const fallbackSize = category === 'BOTTOM' ? profile?.usual_size_bottom : profile?.usual_size_top;
      return {
        recommendedSize: fallbackSize || null,
        confidence: fallbackSize ? 0.4 : 0,
        alternatives: [],
        reason: fallbackSize
          ? 'Aucune grille de tailles pour cette marque. Recommandation basée sur votre taille habituelle.'
          : 'Aucune donnée de taille disponible.',
        usedMeasurements: [],
        fallback: true,
      };
    }

    if (!profile || (!profile.chest && !profile.waist && !profile.hips)) {
      return {
        recommendedSize: null,
        confidence: 0,
        alternatives: charts.slice(0, 3).map((c) => ({ size: c.size_label, confidence: 0 })),
        reason: 'Complétez votre profil de mensurations pour obtenir une recommandation personnalisée.',
        usedMeasurements: [],
        fallback: true,
      };
    }

    // Score each chart row. Low distance = good fit.
    const scored = charts.map((c) => {
      let totalDist = 0;
      let count = 0;
      const measurementsUsed: string[] = [];

      const compare = (userVal: number | null, chartMid: number | null, key: string) => {
        if (userVal == null || chartMid == null) return;
        totalDist += Math.abs(userVal - chartMid);
        count++;
        measurementsUsed.push(key);
      };

      if (category === 'TOP' || category === 'DRESS') {
        compare(profile.chest, midpoint(c.chest_min, c.chest_max), 'chest');
        compare(profile.shoulder_width, null, 'shoulder'); // not in chart yet
      }
      if (category === 'BOTTOM' || category === 'DRESS') {
        compare(profile.waist, midpoint(c.waist_min, c.waist_max), 'waist');
        compare(profile.hips, midpoint(c.hips_min, c.hips_max), 'hips');
      }
      if (category === 'SHOES') {
        compare(profile.shoe_size_eu, c.shoe_size_eu, 'shoe_size');
      }

      const avgDist = count > 0 ? totalDist / count : Infinity;
      return { chart: c, avgDist, measurementsUsed };
    }).filter((s) => isFinite(s.avgDist));

    if (scored.length === 0) {
      return {
        recommendedSize: null,
        confidence: 0,
        alternatives: [],
        reason: 'Mensurations incompatibles avec la catégorie du produit.',
        usedMeasurements: [],
        fallback: true,
      };
    }

    scored.sort((a, b) => a.avgDist - b.avgDist);

    // Apply fit preference: TIGHT → pick one smaller, LOOSE → one bigger
    let bestIdx = 0;
    if (profile.fit_preference === 'TIGHT' && bestIdx > 0) bestIdx = Math.max(0, bestIdx - 1);
    if (profile.fit_preference === 'LOOSE' && bestIdx < scored.length - 1) bestIdx++;

    const best = scored[bestIdx];

    // Confidence: distance < 2cm → 0.95, < 5cm → 0.75, < 10cm → 0.55, else 0.30
    let conf = 0.3;
    if (best.avgDist <= 2) conf = 0.95;
    else if (best.avgDist <= 5) conf = 0.8;
    else if (best.avgDist <= 10) conf = 0.55;

    const alts = scored
      .filter((s) => s.chart.size_label !== best.chart.size_label)
      .slice(0, 2)
      .map((s) => ({ size: s.chart.size_label, confidence: Math.max(0.1, 1 - s.avgDist / 20) }));

    return {
      recommendedSize: best.chart.size_label,
      confidence: Math.round(conf * 100) / 100,
      alternatives: alts,
      reason: this.buildReason(best.avgDist, profile.fit_preference, best.measurementsUsed),
      usedMeasurements: best.measurementsUsed,
      fallback: false,
    };
  }

  private buildReason(dist: number, fit: string, used: string[]): string {
    const parts: string[] = [];
    parts.push(`Basé sur ${used.join(', ') || 'votre profil'}`);
    if (dist <= 2) parts.push('correspondance quasi parfaite');
    else if (dist <= 5) parts.push('correspondance très bonne');
    else if (dist <= 10) parts.push('correspondance correcte');
    else parts.push('correspondance approximative — nous avons pris la taille la plus proche');
    if (fit === 'TIGHT') parts.push('(ajusté à votre préférence près du corps)');
    if (fit === 'LOOSE') parts.push('(ajusté à votre préférence ample)');
    return parts.join(', ') + '.';
  }

  private deriveCategory(p: Product): string {
    const f = (p as any).famille || '';
    const t = (p.title || '').toLowerCase();
    if (/chauss|shoe|basket|sneaker/.test(t) || /shoe|chauss/.test(f.toLowerCase())) return 'SHOES';
    if (/robe|dress/.test(t)) return 'DRESS';
    if (/pantalon|jean|short|jupe|trouser/.test(t)) return 'BOTTOM';
    return 'TOP';
  }

  private deriveBrand(p: Product): string {
    return (p as any).brand || (p as any).marque || 'DEFAULT';
  }

  // ═══ Admin size chart CRUD ═════════════════════════════════════════════

  listCharts(brand?: string, category?: string) {
    const qb = this.chartRepo.createQueryBuilder('c').orderBy('c.brand').addOrderBy('c.category').addOrderBy('c.size_label');
    if (brand) qb.andWhere('c.brand = :b', { b: brand });
    if (category) qb.andWhere('c.category = :c', { c: category });
    return qb.getMany();
  }

  async upsertChart(data: Partial<SizeChart>) {
    if (!data.brand || !data.category || !data.size_label) throw new Error('brand + category + size_label requis');
    let row = await this.chartRepo.findOne({
      where: { brand: data.brand, category: data.category, size_label: data.size_label },
    });
    if (!row) row = this.chartRepo.create({ brand: data.brand, category: data.category, size_label: data.size_label });
    Object.assign(row, data);
    return this.chartRepo.save(row);
  }

  async deleteChart(id: number) {
    await this.chartRepo.delete({ id });
    return { success: true };
  }
}
