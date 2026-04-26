import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';

import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { EmailLog, EmailLogStatus } from './entities/email-log.entity';

// 1×1 transparent PNG, base64-encoded (43 bytes decoded)
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
  'base64',
);

@Controller('email-tracking')
@SkipTransform()
export class EmailTrackingController {
  constructor(@InjectRepository(EmailLog) private readonly repo: Repository<EmailLog>) {}

  // GET /api/email-tracking/pixel/:trackingId.png — open-tracking beacon.
  @Get('pixel/:file')
  async pixel(@Param('file') file: string, @Res() res: Response) {
    // Serve the pixel regardless of whether the tracking id matches — mail clients
    // cache pixels and we must not leak validity info via HTTP status.
    const trackingId = (file || '').replace(/\.png$/i, '');
    if (trackingId) {
      try {
        const row = await this.repo.findOne({ where: { tracking_id: trackingId } });
        if (row) {
          row.opens_count = (row.opens_count || 0) + 1;
          const now = new Date();
          if (!row.first_opened_at) row.first_opened_at = now;
          row.last_opened_at = now;
          if (row.status === EmailLogStatus.SENT) row.status = EmailLogStatus.OPENED;
          await this.repo.save(row);
        }
      } catch { /* best-effort, never block the pixel */ }
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.end(PIXEL_PNG);
  }

  // GET /api/email-tracking/click/:trackingId?u=<encoded-url> — click-through tracker.
  @Get('click/:trackingId')
  async click(
    @Param('trackingId') trackingId: string,
    @Query('u') u: string,
    @Res() res: Response,
  ) {
    let target = 'https://barsha.com.tn';
    try {
      if (u) target = decodeURIComponent(u);
    } catch { /* fall back to default */ }
    try {
      const row = await this.repo.findOne({ where: { tracking_id: trackingId } });
      if (row) {
        row.clicks_count = (row.clicks_count || 0) + 1;
        if (row.status === EmailLogStatus.SENT || row.status === EmailLogStatus.OPENED) {
          row.status = EmailLogStatus.CLICKED;
        }
        await this.repo.save(row);
      }
    } catch {}
    res.redirect(302, target);
  }
}
