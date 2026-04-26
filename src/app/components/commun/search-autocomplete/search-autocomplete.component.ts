import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, catchError, of } from 'rxjs';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-search-autocomplete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="ac-wrap" *ngIf="suggestions.length > 0">
      <div class="ac-label">✨ Suggestions</div>
      <div class="ac-list">
        <a *ngFor="let s of suggestions" class="ac-item" [routerLink]="['/detail-produit', s.id]">
          <img *ngIf="s.image" [src]="s.image" />
          <div>
            <div class="ac-title">{{ s.title }}</div>
            <div class="ac-price">{{ s.price | number:'1.2-2' }} TND</div>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .ac-wrap { padding: 10px 14px; background: linear-gradient(90deg, #eef2ff, #fdf2f8); border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .ac-label { font-size: 11px; font-weight: 600; color: #6366f1; letter-spacing: 1px; margin-bottom: 6px; }
    .ac-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .ac-item { flex: 0 0 160px; display: flex; gap: 8px; background: #fff; padding: 8px; border-radius: 8px; text-decoration: none; color: inherit; border: 1px solid #f3f4f6; transition: transform .15s; }
    .ac-item:hover { transform: translateY(-2px); border-color: #6366f1; }
    .ac-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; }
    .ac-title { font-size: 12px; color: #111827; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ac-price { font-size: 13px; color: #10b981; font-weight: 700; margin-top: 2px; }
  `]
})
export class SearchAutocompleteComponent implements OnChanges {
  @Input() query = '';
  suggestions: any[] = [];
  private subj = new Subject<string>();

  constructor(private http: HttpClient) {
    this.subj.pipe(
      debounceTime(250),
      switchMap(q => {
        if (!q || q.trim().length < 2) return of({ suggestions: [] });
        return this.http.get<any>(`${environementDev.api}/api/storefront/w4/autocomplete?q=${encodeURIComponent(q)}&limit=6`)
          .pipe(catchError(() => of({ suggestions: [] })));
      })
    ).subscribe(r => this.suggestions = r.suggestions || []);
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['query']) this.subj.next(this.query || '');
  }
}
