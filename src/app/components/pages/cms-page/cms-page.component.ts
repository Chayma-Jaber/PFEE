import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';
import { CmsBlocksComponent } from '../../commun/cms-blocks/cms-blocks.component';

@Component({
  selector: 'app-cms-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CmsBlocksComponent],
  template: `
    <div class="cms-page-wrap">
      <div *ngIf="loading" class="state">Chargement…</div>
      <div *ngIf="!loading && !page" class="state error-state">
        <h1>Page introuvable</h1>
        <p>Cette page n'existe pas ou n'est pas encore publiée.</p>
        <a routerLink="/" class="btn">Retour à l'accueil</a>
      </div>
      <div *ngIf="!loading && page" class="cms-content">
        <app-cms-blocks [blocks]="page.blocks || []"></app-cms-blocks>
      </div>
    </div>
  `,
  styles: [`
    .cms-page-wrap { max-width: 1180px; margin: 0 auto; padding: 16px; }
    .state { padding: 80px 20px; text-align: center; color: #6b7280; }
    .error-state h1 { color: #111827; margin-bottom: 8px; }
    .btn { display: inline-block; margin-top: 14px; padding: 11px 22px; background: #111;
           color: #fff; border-radius: 999px; text-decoration: none; font-size: 14px; }
  `]
})
export class CmsPageComponent implements OnInit, OnDestroy {
  loading = true;
  page: any = null;
  private routeSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit() {
    // Re-fetch when the slug changes within the same component instance.
    this.routeSub = this.route.paramMap.subscribe((p) => {
      const slug = p.get('slug');
      if (slug) this.load(slug);
    });
  }

  ngOnDestroy() { this.routeSub?.unsubscribe(); }

  private load(slug: string) {
    this.loading = true;
    this.page = null;
    const locale = (document?.documentElement?.lang || 'fr').slice(0, 2);
    this.http.get<any>(`${environementDev.api}/api/storefront/pages/${encodeURIComponent(slug)}?locale=${locale}`)
      .subscribe({
        next: (r) => {
          this.page = r?.page || null;
          this.loading = false;
          if (this.page) this.applySeo(this.page);
        },
        error: () => { this.loading = false; this.page = null; }
      });
  }

  private applySeo(page: any) {
    if (page.title) this.title.setTitle(page.title + ' | Barsha');
    if (page.meta_description) this.meta.updateTag({ name: 'description', content: page.meta_description });
    if (page.cover_image) this.meta.updateTag({ property: 'og:image', content: page.cover_image });
  }
}
