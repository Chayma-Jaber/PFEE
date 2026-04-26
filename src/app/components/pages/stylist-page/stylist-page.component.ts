import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiStylistComponent } from '../../commun/ai-stylist/ai-stylist.component';

@Component({
  selector: 'app-stylist-page',
  standalone: true,
  imports: [CommonModule, AiStylistComponent],
  template: `
    <div class="page">
      <app-ai-stylist></app-ai-stylist>
    </div>
  `,
  styles: [`.page { padding: 20px; min-height: 80vh; background: #fafafa; }`]
})
export class StylistPageComponent {}
