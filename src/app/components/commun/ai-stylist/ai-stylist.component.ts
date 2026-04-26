import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

interface Suggestion {
  productId: number;
  title: string;
  price: number;
  image: string | null;
  reason: string;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[];
  followUps?: string[];
}

@Component({
  selector: 'app-ai-stylist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="stylist">
      <div class="hero">
        <div class="avatar"><i class="fas fa-magic"></i></div>
        <div>
          <h2>Barsha Stylist</h2>
          <p>Votre conseiller·e mode personnel·le. Dites-moi l'occasion, le style, le budget — je vous propose la tenue parfaite.</p>
        </div>
      </div>

      <div class="messages" #messagesEl>
        <div *ngFor="let t of history" class="msg" [class.user]="t.role==='user'" [class.assistant]="t.role==='assistant'">
          <div class="bubble" [innerHTML]="formatContent(t.content)"></div>
          <div class="suggestions" *ngIf="t.suggestions?.length">
            <div class="sug-card" *ngFor="let s of t.suggestions">
              <img *ngIf="s.image" [src]="s.image" [alt]="s.title" />
              <div class="sug-body">
                <strong>{{ s.title }}</strong>
                <div class="price">{{ s.price }} TND</div>
                <p class="reason">{{ s.reason }}</p>
                <div class="sug-actions">
                  <a [routerLink]="['/detail-produit', s.productId]" class="btn-mini">Voir</a>
                  <button class="btn-mini primary" (click)="addToCart(s)">Ajouter</button>
                </div>
              </div>
            </div>
          </div>
          <div class="follow-ups" *ngIf="t.followUps?.length">
            <button *ngFor="let q of t.followUps" class="follow-up" (click)="quickAsk(q)">{{ q }}</button>
          </div>
        </div>

        <div *ngIf="loading" class="msg assistant">
          <div class="bubble typing"><span></span><span></span><span></span></div>
        </div>

        <div *ngIf="history.length === 0" class="empty-prompts">
          <p>Quelques suggestions pour démarrer :</p>
          <div class="prompt-chips">
            <button (click)="quickAsk(p)" *ngFor="let p of suggestedPrompts">{{ p }}</button>
          </div>
        </div>
      </div>

      <form class="composer" (submit)="$event.preventDefault(); send()">
        <input type="text" [(ngModel)]="message" name="message" placeholder="Décrivez votre besoin (ex: tenue mariage, budget 200 TND, style chic)…" [disabled]="loading" />
        <button type="submit" [disabled]="!message.trim() || loading">
          <i class="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; max-width: 820px; margin: 0 auto; }
    .stylist { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
    .hero { display: flex; gap: 14px; padding: 18px 22px; background: linear-gradient(135deg, #eef2ff, #fce7f3); border-bottom: 1px solid #e5e7eb; align-items: center; }
    .hero h2 { margin: 0; font-size: 18px; color: #111827; }
    .hero p { margin: 2px 0 0; font-size: 13px; color: #4b5563; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .messages { padding: 20px; display: flex; flex-direction: column; gap: 14px; min-height: 380px; max-height: 600px; overflow-y: auto; }
    .msg { display: flex; flex-direction: column; gap: 8px; max-width: 85%; }
    .msg.user { align-self: flex-end; align-items: flex-end; }
    .msg.assistant { align-self: flex-start; }
    .bubble { padding: 11px 15px; border-radius: 16px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    .msg.user .bubble { background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; border-bottom-right-radius: 4px; }
    .msg.assistant .bubble { background: #f3f4f6; color: #111827; border-bottom-left-radius: 4px; }
    .typing span { display: inline-block; width: 6px; height: 6px; margin: 0 2px; background: #9ca3af; border-radius: 50%; animation: bounce 1.2s infinite; }
    .typing span:nth-child(2) { animation-delay: .2s; }
    .typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce { 0%, 80%, 100% { transform: scale(0.8); opacity: .5; } 40% { transform: scale(1.2); opacity: 1; } }
    .suggestions { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 6px; }
    .sug-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .sug-card img { width: 100%; height: 140px; object-fit: cover; }
    .sug-body { padding: 10px 12px; flex: 1; display: flex; flex-direction: column; }
    .sug-body strong { font-size: 13px; color: #111827; line-height: 1.3; }
    .price { font-weight: 700; color: #ec4899; margin-top: 4px; }
    .reason { font-size: 11px; color: #6b7280; margin: 4px 0 8px; flex: 1; }
    .sug-actions { display: flex; gap: 6px; }
    .btn-mini { flex: 1; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; text-align: center; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; text-decoration: none; }
    .btn-mini.primary { background: #111; color: #fff; border-color: #111; }
    .follow-ups { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .follow-up { background: #fff; border: 1px solid #c7d2fe; color: #4f46e5; padding: 5px 10px; font-size: 12px; border-radius: 999px; cursor: pointer; }
    .follow-up:hover { background: #eef2ff; }
    .empty-prompts { padding: 20px; text-align: center; color: #6b7280; }
    .empty-prompts p { margin: 0 0 10px; font-size: 13px; }
    .prompt-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .prompt-chips button { background: linear-gradient(135deg, #eef2ff, #fce7f3); border: 1px solid #c7d2fe; padding: 7px 14px; border-radius: 999px; font-size: 12px; cursor: pointer; color: #4338ca; }
    .composer { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #fafafa; }
    .composer input { flex: 1; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 999px; font-size: 14px; }
    .composer button { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; border: none; cursor: pointer; }
    .composer button:disabled { opacity: .5; cursor: not-allowed; }
  `]
})
export class AiStylistComponent {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

  history: ChatTurn[] = [];
  message = '';
  loading = false;
  suggestedPrompts = [
    'Tenue mariage budget 250 TND',
    'Look bureau pour femme',
    'Tenue plage casual',
    'Cadeau Saint-Valentin pour ma copine',
    'Style soirée chic homme',
  ];

  constructor(private http: HttpClient, private router: Router) {}

  quickAsk(q: string) { this.message = q; this.send(); }

  send() {
    const text = this.message.trim();
    if (!text || this.loading) return;
    this.history.push({ role: 'user', content: text });
    this.message = '';
    this.loading = true;
    this.scrollToEnd();

    const token = localStorage.getItem('jwt');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const last10 = this.history.slice(-10).map(t => ({ role: t.role, content: t.content }));

    this.http.post<any>(`${environementDev.api}/api/ai/stylist/chat`,
      { message: text, history: last10.slice(0, -1) },
      { headers }
    ).subscribe({
      next: r => {
        this.history.push({
          role: 'assistant',
          content: r?.reply || 'Désolé, je n\'ai pas de réponse pour l\'instant.',
          suggestions: r?.suggestions || [],
          followUps: r?.followUpQuestions || [],
        });
        this.loading = false;
        this.scrollToEnd();
      },
      error: () => {
        this.history.push({ role: 'assistant', content: 'Le service est temporairement indisponible. Réessayez dans un instant.' });
        this.loading = false;
        this.scrollToEnd();
      }
    });
  }

  addToCart(s: Suggestion) {
    // Navigate to the PDP — variant selection (size/colour) belongs there, not the chat panel.
    this.router.navigate(['/detail-produit', s.productId]);
  }

  formatContent(s: string): string {
    return (s || '').replace(/\n/g, '<br/>');
  }

  private scrollToEnd() {
    setTimeout(() => {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
