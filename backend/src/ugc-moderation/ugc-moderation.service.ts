import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UgcPost } from '../wave4/wave4.entities';
import { EventBusService } from '../platform/events/event-bus.service';

export interface ModerationDecision {
  postId: number;
  autoDecision: 'AUTO_APPROVE' | 'AUTO_REJECT' | 'NEEDS_REVIEW';
  scores: {
    nsfw: number;
    spam: number;
    quality: number;
    overall: number;
  };
  reasons: string[];
}

// French/English profanity + spam dictionary. Tiny but useful first pass.
const SPAM_TERMS = [
  'http://', 'https://', 'whatsapp', 'whats app', 'wa.me/',
  '.com', '.tn', '.fr', 't.me/', 'instagram.com', 'tiktok.com',
  'free money', 'argent gratuit', 'click here', 'cliquez ici',
];
const NSFW_TERMS = [
  // intentionally generic — tune per language
  'nsfw', 'porn', 'porno', 'xxx', 'sexy time', 'nude', 'nu', 'sextoy',
];

@Injectable()
export class UgcModerationService {
  private readonly logger = new Logger(UgcModerationService.name);
  private readonly autoApproveAbove: number;
  private readonly autoRejectBelow: number;

  constructor(
    @InjectRepository(UgcPost) private readonly ugcRepo: Repository<UgcPost>,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
  ) {
    this.autoApproveAbove = this.config.get<number>('moderation.autoApproveAbove', 75);
    this.autoRejectBelow = this.config.get<number>('moderation.autoRejectBelow', 30);
  }

  // Score a single post. Combines:
  //  - keyword spam check on caption
  //  - keyword NSFW check on caption
  //  - basic image-URL heuristics (extension, host)
  //  - quality (caption length, presence of product link)
  scorePost(post: UgcPost): ModerationDecision {
    const caption = (post.caption || '').toLowerCase();
    const url = (post.image_url || '').toLowerCase();
    const reasons: string[] = [];

    // SPAM: count occurrences of spam terms
    let spamHits = 0;
    for (const t of SPAM_TERMS) if (caption.includes(t)) spamHits++;
    const spamScore = Math.max(0, 100 - spamHits * 25);
    if (spamHits > 0) reasons.push(`spam_terms_${spamHits}`);

    // NSFW: term match on caption
    let nsfwHits = 0;
    for (const t of NSFW_TERMS) if (caption.includes(t)) nsfwHits++;
    const nsfwScore = nsfwHits === 0 ? 100 : Math.max(0, 100 - nsfwHits * 50);
    if (nsfwHits > 0) reasons.push(`nsfw_terms_${nsfwHits}`);

    // Image URL plausibility: must be a known image extension and not a redirector
    let imgScore = 100;
    if (url) {
      const okExt = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
      const looksRedirect = /(bit\.ly|tinyurl|goo\.gl|t\.co)\//.test(url);
      if (!okExt) { imgScore -= 30; reasons.push('image_unknown_ext'); }
      if (looksRedirect) { imgScore -= 30; reasons.push('image_redirect_host'); }
      if (!url.startsWith('http')) { imgScore -= 50; reasons.push('image_invalid_url'); }
    } else {
      imgScore = 0;
      reasons.push('no_image');
    }

    // Quality: caption length + product link
    let qualityScore = 50;
    if (caption.length >= 20) qualityScore += 25;
    if (post.product_id) qualityScore += 15;
    if (caption.length > 200) qualityScore += 10;
    qualityScore = Math.min(100, qualityScore);

    const overall = Math.round((spamScore * 0.3 + nsfwScore * 0.35 + imgScore * 0.2 + qualityScore * 0.15));

    let autoDecision: ModerationDecision['autoDecision'] = 'NEEDS_REVIEW';
    if (overall >= this.autoApproveAbove && nsfwHits === 0 && spamHits === 0) autoDecision = 'AUTO_APPROVE';
    else if (overall < this.autoRejectBelow || nsfwHits >= 2) autoDecision = 'AUTO_REJECT';

    return {
      postId: post.id,
      autoDecision,
      scores: { nsfw: nsfwScore, spam: spamScore, quality: qualityScore, overall },
      reasons,
    };
  }

  // Run the moderation pipeline over all PENDING posts.
  async runPipeline(limit = 200) {
    const pending = await this.ugcRepo.find({ where: { status: 'PENDING' as any }, take: limit });
    let approved = 0, rejected = 0, queued = 0;
    const decisions: ModerationDecision[] = [];

    for (const post of pending) {
      const decision = this.scorePost(post);
      decisions.push(decision);

      if (decision.autoDecision === 'AUTO_APPROVE') {
        post.status = 'APPROVED' as any;
        post.moderated_at = new Date();
        await this.ugcRepo.save(post);
        approved++;
        this.eventBus.publish('ugc.auto_approved', { postId: post.id, scores: decision.scores }, {
          aggregateId: `ugc:${post.id}`,
        }).catch(() => {});
      } else if (decision.autoDecision === 'AUTO_REJECT') {
        post.status = 'REJECTED' as any;
        post.moderated_at = new Date();
        await this.ugcRepo.save(post);
        rejected++;
        this.eventBus.publish('ugc.auto_rejected', { postId: post.id, reasons: decision.reasons }, {
          aggregateId: `ugc:${post.id}`,
        }).catch(() => {});
      } else {
        queued++;
      }
    }

    return { processed: pending.length, autoApproved: approved, autoRejected: rejected, needsReview: queued, decisions };
  }

  // Review queue — posts left for humans after the auto-pass
  async reviewQueue(limit = 100) {
    const items = await this.ugcRepo.find({ where: { status: 'PENDING' as any }, take: limit, order: { created_at: 'ASC' } });
    return items.map((p) => ({ ...p, moderation: this.scorePost(p) }));
  }

  // Statistics
  async stats() {
    const [pending, approved, rejected] = await Promise.all([
      this.ugcRepo.count({ where: { status: 'PENDING' as any } }),
      this.ugcRepo.count({ where: { status: 'APPROVED' as any } }),
      this.ugcRepo.count({ where: { status: 'REJECTED' as any } }),
    ]);
    return { pending, approved, rejected };
  }
}
