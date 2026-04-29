import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import {
  ADMIN_MODULE_CONTEXT,
  AdminModuleContext,
  AdminModuleContextKey,
} from './admin-module-context.data';

@Component({
  selector: 'app-admin-module-context',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="module-context" *ngIf="context">
      <div class="module-context__head">
        <span class="module-context__eyebrow">Contexte du module</span>
        <h2>Ce que fait ce module et pourquoi il est utile</h2>
      </div>

      <div class="module-context__grid">
        <article class="module-context__card">
          <h3>Explication</h3>
          <p>{{ context.explanation }}</p>
        </article>

        <article class="module-context__card">
          <h3>Utilite</h3>
          <p>{{ context.utility }}</p>
        </article>
      </div>

      <article class="module-context__card module-context__card--full">
        <h3>Donnees seedes reelles utilisees dans le projet</h3>
        <ul>
          <li *ngFor="let item of context.seededExamples">{{ item }}</li>
        </ul>
      </article>
    </section>
  `,
  styles: [`
    .module-context { margin-bottom: 20px; }
    .module-context__head { margin-bottom: 10px; }
    .module-context__eyebrow {
      display: inline-block;
      margin-bottom: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .4px;
      text-transform: uppercase;
    }
    .module-context__head h2 {
      margin: 0;
      font-size: 18px;
      color: #111827;
    }
    .module-context__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .module-context__card {
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .module-context__card h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #111827;
    }
    .module-context__card p {
      margin: 0;
      color: #4b5563;
      font-size: 13px;
      line-height: 1.55;
    }
    .module-context__card ul {
      margin: 0;
      padding-left: 18px;
      color: #4b5563;
      font-size: 13px;
      line-height: 1.55;
    }
    .module-context__card li + li { margin-top: 4px; }
    @media (max-width: 900px) {
      .module-context__grid { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminModuleContextComponent {
  @Input({ required: true }) moduleKey!: AdminModuleContextKey;

  get context(): AdminModuleContext | null {
    return ADMIN_MODULE_CONTEXT[this.moduleKey] ?? null;
  }
}
