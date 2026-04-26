import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

type Tab = 'crm' | 'tasks' | 'sla' | 'signals' | 'deals' | 'ugc' | 'slots' | 'pickup' | 'insights' | 'export' | 'audit';

@Component({
  selector: 'app-admin-wave4',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="w4">
  <div class="head">
    <h1>Wave 4 <span class="chip">CRM + Ops + BI</span></h1>
    <p>Tags clients, tâches équipe, SLA support, churn/CLV, deal du jour, UGC, slots, pickup, lookalikes, stockout, export, audit.</p>
  </div>
  <div class="alert ok" *ngIf="ok"><i class="fas fa-check"></i> {{ ok }}</div>
  <div class="alert err" *ngIf="err"><i class="fas fa-exclamation"></i> {{ err }}</div>

  <div class="tabs">
    <button [class.active]="tab==='crm'" (click)="switch('crm')">👥 CRM client</button>
    <button [class.active]="tab==='tasks'" (click)="switch('tasks')">📋 Tâches</button>
    <button [class.active]="tab==='sla'" (click)="switch('sla')">⏱️ SLA Support</button>
    <button [class.active]="tab==='signals'" (click)="switch('signals')">📊 Churn/CLV</button>
    <button [class.active]="tab==='deals'" (click)="switch('deals')">🔥 Deal du jour</button>
    <button [class.active]="tab==='ugc'" (click)="switch('ugc')">📸 UGC</button>
    <button [class.active]="tab==='slots'" (click)="switch('slots')">🚚 Créneaux</button>
    <button [class.active]="tab==='pickup'" (click)="switch('pickup')">🏪 Click & Collect</button>
    <button [class.active]="tab==='insights'" (click)="switch('insights')">🎯 Lookalikes & Stockout</button>
    <button [class.active]="tab==='export'" (click)="switch('export')">📥 Export CSV</button>
    <button [class.active]="tab==='audit'" (click)="switch('audit')">🔒 Audit diff</button>
  </div>

  <!-- CRM (tags + notes) -->
  <section *ngIf="tab==='crm'" class="card">
    <h3>Tags + notes sur un client</h3>
    <div class="row"><input type="number" [(ngModel)]="crmUserId" placeholder="ID client" /><button (click)="loadCrm()">Charger</button></div>
    <div *ngIf="crmUserId" class="row">
      <input type="text" [(ngModel)]="newTag" placeholder="Nouveau tag (ex: VIP, WHOLESALE)" />
      <button (click)="addTag()">+ Tag</button>
    </div>
    <div class="chips"><span *ngFor="let t of tags" class="chip-item">{{ t.tag }}</span></div>
    <div *ngIf="crmUserId" class="row">
      <textarea rows="2" [(ngModel)]="newNote" placeholder="Ajouter une note interne..."></textarea>
      <button (click)="addNote()">+ Note</button>
    </div>
    <ul class="notes-list">
      <li *ngFor="let n of notes"><strong>{{ n.admin_name }}</strong> — {{ formatDate(n.created_at) }}<br>{{ n.note }}</li>
    </ul>
  </section>

  <!-- Tasks -->
  <section *ngIf="tab==='tasks'" class="card">
    <h3>Tableau de tâches</h3>
    <div class="row">
      <input type="text" [(ngModel)]="newTask.title" placeholder="Titre de tâche" />
      <select [(ngModel)]="newTask.priority"><option value="LOW">Faible</option><option value="MEDIUM">Moyenne</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select>
      <input type="text" [(ngModel)]="newTask.category" placeholder="Catégorie" />
      <button (click)="createTask()">+ Ajouter</button>
    </div>
    <div class="kanban">
      <div class="col" *ngFor="let col of taskCols">
        <h4>{{ col.label }}</h4>
        <div class="task-card" *ngFor="let t of tasksByStatus(col.key)">
          <strong>{{ t.title }}</strong>
          <span class="pill pri-{{t.priority.toLowerCase()}}">{{ t.priority }}</span>
          <p>{{ t.description }}</p>
          <div class="actions">
            <select (change)="moveTask(t, $any($event.target).value)">
              <option *ngFor="let c of taskCols" [value]="c.key" [selected]="c.key===t.status">{{ c.label }}</option>
            </select>
            <button class="del" (click)="deleteTask(t)">×</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- SLA -->
  <section *ngIf="tab==='sla'" class="card">
    <h3>SLA Support — Rapport</h3>
    <div *ngIf="sla">
      <div class="stats"><span class="stat ok-stat">{{ sla.compliant }} OK</span><span class="stat warn">{{ sla.atRisk }} À risque</span><span class="stat danger">{{ sla.breached }} Dépassé</span></div>
      <h4>Tickets en dépassement</h4>
      <table class="data"><thead><tr><th>ID</th><th>Sujet</th><th>Priorité</th><th>Âge (h)</th><th>SLA (h)</th></tr></thead>
        <tbody><tr *ngFor="let b of sla.breaches"><td>#{{ b.id }}</td><td>{{ b.subject }}</td><td>{{ b.priority }}</td><td>{{ b.ageHours }}</td><td>{{ b.slaHours }}</td></tr></tbody>
      </table>
    </div>
  </section>

  <!-- Signals -->
  <section *ngIf="tab==='signals'" class="card">
    <h3>Signaux clients — Churn & CLV</h3>
    <button class="btn" (click)="computeSignals()"><i class="fas fa-sync"></i> Recomputer les signaux</button>
    <div class="two-col">
      <div>
        <h4>🏆 Top CLV</h4>
        <table class="data"><thead><tr><th>Client</th><th>Email</th><th>CLV</th></tr></thead>
          <tbody><tr *ngFor="let s of topClv"><td>{{ s.name }}</td><td>{{ s.email }}</td><td><strong>{{ s.clv }}</strong> TND</td></tr></tbody>
        </table>
      </div>
      <div>
        <h4>⚠️ At-risk</h4>
        <table class="data"><thead><tr><th>Client</th><th>Churn</th><th>Jours inactif</th></tr></thead>
          <tbody><tr *ngFor="let s of atRisk"><td>{{ s.name }}</td><td>{{ s.churnScore }}%</td><td>{{ s.daysSince }}</td></tr></tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Deals -->
  <section *ngIf="tab==='deals'" class="card">
    <h3>Deal du jour</h3>
    <div class="row">
      <input type="number" [(ngModel)]="newDeal.productId" placeholder="ID produit" />
      <input type="number" step="0.01" [(ngModel)]="newDeal.specialPrice" placeholder="Prix spécial" />
      <input type="datetime-local" [(ngModel)]="newDeal.startAt" />
      <input type="datetime-local" [(ngModel)]="newDeal.endAt" />
      <input type="text" [(ngModel)]="newDeal.headline" placeholder="Titre mise en avant" />
      <button (click)="createDeal()">+ Planifier</button>
    </div>
    <table class="data"><thead><tr><th>Produit</th><th>Prix spécial</th><th>Début</th><th>Fin</th><th></th></tr></thead>
      <tbody><tr *ngFor="let d of deals"><td>#{{ d.product_id }}</td><td>{{ d.special_price }}</td><td>{{ formatDate(d.start_at) }}</td><td>{{ formatDate(d.end_at) }}</td><td><button class="del" (click)="deleteDeal(d)">×</button></td></tr></tbody>
    </table>
  </section>

  <!-- UGC -->
  <section *ngIf="tab==='ugc'" class="card">
    <h3>Modération UGC</h3>
    <div class="ugc-grid">
      <div class="ugc-card" *ngFor="let p of ugcPending">
        <img [src]="p.image_url" />
        <p>{{ p.caption }}</p>
        <div class="actions"><button (click)="approveUgc(p)" class="approve">Approuver</button><button class="del" (click)="rejectUgc(p)">Rejeter</button></div>
      </div>
    </div>
  </section>

  <!-- Slots -->
  <section *ngIf="tab==='slots'" class="card">
    <h3>Créneaux de livraison</h3>
    <div class="row">
      <input type="text" [(ngModel)]="newSlot.label" placeholder="MORNING/AFTERNOON" />
      <input type="text" [(ngModel)]="newSlot.startTime" placeholder="09:00" />
      <input type="text" [(ngModel)]="newSlot.endTime" placeholder="12:00" />
      <input type="text" [(ngModel)]="newSlot.city" placeholder="Ville (vide = toutes)" />
      <input type="number" [(ngModel)]="newSlot.capacity" placeholder="Capacité" />
      <button (click)="createSlot()">+ Créneau</button>
    </div>
    <table class="data"><thead><tr><th>Label</th><th>Début</th><th>Fin</th><th>Ville</th><th>Capacité</th></tr></thead>
      <tbody><tr *ngFor="let s of slots"><td>{{ s.label }}</td><td>{{ s.start_time }}</td><td>{{ s.end_time }}</td><td>{{ s.city || 'toutes' }}</td><td>{{ s.capacity }}</td></tr></tbody>
    </table>
  </section>

  <!-- Pickup -->
  <section *ngIf="tab==='pickup'" class="card">
    <h3>Points de retrait (Click & Collect)</h3>
    <div class="row">
      <input type="text" [(ngModel)]="newPickup.name" placeholder="Nom du point" />
      <input type="text" [(ngModel)]="newPickup.address" placeholder="Adresse" />
      <input type="text" [(ngModel)]="newPickup.city" placeholder="Ville" />
      <input type="text" [(ngModel)]="newPickup.phone" placeholder="Téléphone" />
      <input type="text" [(ngModel)]="newPickup.hours" placeholder="Horaires" />
      <button (click)="createPickup()">+ Ajouter</button>
    </div>
    <table class="data"><thead><tr><th>Nom</th><th>Ville</th><th>Adresse</th><th>Horaires</th></tr></thead>
      <tbody><tr *ngFor="let p of pickups"><td>{{ p.name }}</td><td>{{ p.city }}</td><td>{{ p.address }}</td><td>{{ p.hours }}</td></tr></tbody>
    </table>
  </section>

  <!-- Insights -->
  <section *ngIf="tab==='insights'" class="card">
    <h3>Lookalikes + Stockout forecast</h3>
    <div class="row"><button (click)="loadLookalikes()">🎯 Lookalikes VIP</button><button (click)="loadStockout()">📉 Stockout 7j</button></div>
    <h4>Lookalikes</h4>
    <table class="data"><thead><tr><th>Client</th><th>Email</th><th>CLV</th><th>Churn</th></tr></thead>
      <tbody><tr *ngFor="let l of lookalikes"><td>{{ l.name }}</td><td>{{ l.email }}</td><td>{{ l.clv }}</td><td>{{ l.churn }}%</td></tr></tbody>
    </table>
    <h4>Prévision stockout</h4>
    <table class="data"><thead><tr><th>Produit</th><th>Stock</th><th>Ventes 30j</th><th>Jours restants</th><th>Risque</th></tr></thead>
      <tbody><tr *ngFor="let s of stockoutForecast"><td>{{ s.title }}</td><td>{{ s.stock }}</td><td>{{ s.sold30 }}</td><td>{{ s.daysLeft }}</td><td><span class="pill risk-{{s.risk.toLowerCase()}}">{{ s.risk }}</span></td></tr></tbody>
    </table>
  </section>

  <!-- Export CSV -->
  <section *ngIf="tab==='export'" class="card">
    <h3>Export unifié CSV</h3>
    <p>Téléchargez des extractions complètes pour analyses BI externes.</p>
    <div class="row">
      <button (click)="exportCsv('orders')"><i class="fas fa-download"></i> Commandes</button>
      <button (click)="exportCsv('customers')"><i class="fas fa-download"></i> Clients</button>
      <button (click)="exportCsv('products')"><i class="fas fa-download"></i> Produits</button>
    </div>
  </section>

  <!-- Audit -->
  <section *ngIf="tab==='audit'" class="card">
    <h3>Audit — différences avant/après</h3>
    <div class="row">
      <input type="text" [(ngModel)]="auditResource" placeholder="Ressource (ex: order, product)" />
      <input type="text" [(ngModel)]="auditResourceId" placeholder="ID ressource" />
      <button (click)="loadAudit()">Filtrer</button>
    </div>
    <table class="data"><thead><tr><th>Date</th><th>Ressource</th><th>Action</th><th>Par</th></tr></thead>
      <tbody><tr *ngFor="let d of auditItems"><td>{{ formatDate(d.timestamp) }}</td><td>{{ d.resource }} #{{ d.resource_id }}</td><td>{{ d.action }}</td><td>{{ d.admin_name }}</td></tr>
      <tr *ngIf="auditItems.length===0"><td colspan="4" class="muted">Aucune modification enregistrée (l'audit diff se remplit automatiquement lors des mutations admin).</td></tr>
      </tbody>
    </table>
  </section>
</div>
  `,
  styles: [`
.w4 { padding:24px; max-width:1400px; }
.head h1 { font-size:24px; font-weight:600; margin:0; display:flex; gap:10px; align-items:center; }
.head .chip { background:linear-gradient(135deg,#fbbf24,#ec4899); color:#fff; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; }
.head p { color:#6b7280; margin:4px 0 20px; font-size:14px; }
.alert { padding:10px 16px; border-radius:8px; margin-bottom:12px; font-size:14px; display:flex; gap:8px; align-items:center; }
.alert.ok { background:#d1fae5; color:#065f46; } .alert.err { background:#fee2e2; color:#991b1b; }
.tabs { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:24px; border-bottom:1px solid #e5e7eb; }
.tabs button { background:none; border:none; padding:10px 14px; font-size:12px; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
.tabs button.active { color:#fbbf24; border-bottom-color:#fbbf24; }
section h3 { font-size:17px; margin:0 0 14px; color:#111827; }
section h4 { font-size:13px; margin:14px 0 8px; color:#374151; }
.card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:18px; }
.row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.row input, .row select, .row textarea { padding:9px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; flex:1; min-width:120px; }
.row button { padding:9px 16px; background:#111; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px; }
.btn { padding:10px 18px; background:#fbbf24; color:#111; border:none; border-radius:8px; cursor:pointer; font-weight:600; margin-bottom:14px; }
.data { width:100%; border-collapse:collapse; font-size:13px; }
.data th, .data td { padding:8px 12px; text-align:left; border-bottom:1px solid #f3f4f6; }
.data th { background:#f9fafb; font-size:11px; text-transform:uppercase; color:#6b7280; font-weight:600; }
.data .muted { text-align:center; color:#9ca3af; padding:20px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
.chip-item { background:#fef3c7; color:#92400e; padding:5px 12px; border-radius:16px; font-size:12px; font-weight:600; }
.notes-list { list-style:none; padding:0; }
.notes-list li { padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:13px; color:#374151; }
.stats { display:flex; gap:10px; margin-bottom:14px; }
.stat { padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px; }
.stat.ok-stat { background:#d1fae5; color:#065f46; }
.stat.warn { background:#fef3c7; color:#92400e; }
.stat.danger { background:#fee2e2; color:#991b1b; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width:900px) { .two-col { grid-template-columns:1fr; } }
.kanban { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:14px; }
@media (max-width:1100px) { .kanban { grid-template-columns:repeat(2,1fr); } }
.kanban .col { background:#f9fafb; border-radius:10px; padding:10px; min-height:150px; }
.kanban .col h4 { margin:0 0 10px; }
.task-card { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin-bottom:8px; }
.task-card strong { display:block; font-size:13px; }
.task-card p { font-size:12px; color:#6b7280; margin:6px 0; }
.pill { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; margin-left:6px; }
.pill.pri-urgent { background:#fee2e2; color:#991b1b; }
.pill.pri-high { background:#fed7aa; color:#9a3412; }
.pill.pri-medium { background:#dbeafe; color:#1e40af; }
.pill.pri-low { background:#f3f4f6; color:#6b7280; }
.pill.risk-critical { background:#fee2e2; color:#991b1b; }
.pill.risk-high { background:#fed7aa; color:#9a3412; }
.pill.risk-medium { background:#dbeafe; color:#1e40af; }
.actions { display:flex; gap:6px; margin-top:6px; }
.actions select { flex:1; padding:4px; border-radius:4px; border:1px solid #d1d5db; font-size:12px; }
.del { background:#fee2e2; color:#dc2626; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; }
.approve { background:#d1fae5; color:#065f46; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; }
.ugc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:14px; }
.ugc-card { background:#f9fafb; border-radius:10px; overflow:hidden; }
.ugc-card img { width:100%; height:180px; object-fit:cover; }
.ugc-card p { padding:8px 10px; margin:0; font-size:12px; color:#374151; }
.ugc-card .actions { padding:0 10px 10px; }
  `]
})
export class AdminWave4Component implements OnInit {
  tab: Tab = 'crm';
  ok = ''; err = '';

  // CRM
  crmUserId: number | null = null;
  tags: any[] = []; notes: any[] = [];
  newTag = ''; newNote = '';

  // Tasks
  tasks: any[] = [];
  newTask: any = { title: '', priority: 'MEDIUM', category: 'general', description: '' };
  taskCols = [
    { key: 'TODO', label: '📋 À faire' },
    { key: 'IN_PROGRESS', label: '🔧 En cours' },
    { key: 'BLOCKED', label: '🚧 Bloqué' },
    { key: 'DONE', label: '✅ Terminé' },
  ];

  // SLA
  sla: any = null;

  // Signals
  topClv: any[] = []; atRisk: any[] = [];

  // Deals
  deals: any[] = [];
  newDeal: any = { productId: null, specialPrice: 0, startAt: '', endAt: '', headline: '' };

  // UGC
  ugcPending: any[] = [];

  // Slots
  slots: any[] = [];
  newSlot: any = { label: 'MORNING', startTime: '09:00', endTime: '12:00', city: '', capacity: 50 };

  // Pickup
  pickups: any[] = [];
  newPickup: any = { name: '', address: '', city: '', phone: '', hours: '' };

  // Insights
  lookalikes: any[] = []; stockoutForecast: any[] = [];

  // Audit
  auditItems: any[] = []; auditResource = ''; auditResourceId = '';

  constructor(private admin: AdminService) {}

  ngOnInit() { this.switch('crm'); }

  switch(t: Tab) {
    this.tab = t; this.ok = ''; this.err = '';
    switch (t) {
      case 'tasks': this.loadTasks(); break;
      case 'sla': this.loadSla(); break;
      case 'signals': this.loadSignals(); break;
      case 'deals': this.loadDeals(); break;
      case 'ugc': this.loadUgc(); break;
      case 'slots': this.loadSlots(); break;
      case 'pickup': this.loadPickups(); break;
      case 'audit': this.loadAudit(); break;
    }
  }

  // CRM
  loadCrm() {
    if (!this.crmUserId) return;
    this.admin.w4_customerTags(this.crmUserId).subscribe(r => this.tags = r.items || []);
    this.admin.w4_customerNotes(this.crmUserId).subscribe(r => this.notes = r.items || []);
  }
  addTag() {
    if (!this.crmUserId || !this.newTag) return;
    this.admin.w4_addCustomerTag(this.crmUserId, this.newTag).subscribe({
      next: () => { this.ok = 'Tag ajouté'; this.newTag = ''; this.loadCrm(); },
      error: () => this.err = 'Erreur'
    });
  }
  addNote() {
    if (!this.crmUserId || !this.newNote) return;
    this.admin.w4_addCustomerNote(this.crmUserId, this.newNote).subscribe({
      next: () => { this.ok = 'Note ajoutée'; this.newNote = ''; this.loadCrm(); },
      error: () => this.err = 'Erreur'
    });
  }

  // Tasks
  loadTasks() { this.admin.w4_listTasks().subscribe(r => this.tasks = r.items || []); }
  tasksByStatus(s: string) { return this.tasks.filter(t => t.status === s); }
  createTask() {
    if (!this.newTask.title) return;
    this.admin.w4_createTask(this.newTask).subscribe({
      next: () => { this.ok = 'Tâche créée'; this.newTask = { title: '', priority: 'MEDIUM', category: 'general', description: '' }; this.loadTasks(); },
      error: () => this.err = 'Erreur'
    });
  }
  moveTask(t: any, status: string) {
    this.admin.w4_updateTask(t.id, { status }).subscribe(() => this.loadTasks());
  }
  deleteTask(t: any) {
    if (!confirm('Supprimer cette tâche ?')) return;
    this.admin.w4_deleteTask(t.id).subscribe(() => { this.ok = 'Supprimée'; this.loadTasks(); });
  }

  // SLA
  loadSla() { this.admin.w4_slaReport().subscribe(r => this.sla = r); }

  // Signals
  loadSignals() {
    this.admin.w4_topClv(5).subscribe(r => this.topClv = r.items || []);
    this.admin.w4_atRisk(5).subscribe(r => this.atRisk = r.items || []);
  }
  computeSignals() {
    this.admin.w4_computeSignals().subscribe({
      next: (r) => { this.ok = `Calculé pour ${r.updated} clients`; this.loadSignals(); },
      error: () => this.err = 'Erreur'
    });
  }

  // Deals
  loadDeals() { this.admin.w4_deals().subscribe(r => this.deals = r.items || []); }
  createDeal() {
    if (!this.newDeal.productId || !this.newDeal.specialPrice) return;
    this.admin.w4_createDeal(this.newDeal).subscribe({
      next: () => { this.ok = 'Deal planifié'; this.newDeal = { productId: null, specialPrice: 0, startAt: '', endAt: '', headline: '' }; this.loadDeals(); },
      error: () => this.err = 'Erreur'
    });
  }
  deleteDeal(d: any) {
    this.admin.w4_deleteDeal(d.id).subscribe(() => { this.ok = 'Supprimé'; this.loadDeals(); });
  }

  // UGC
  loadUgc() { this.admin.w4_ugcList('PENDING').subscribe(r => this.ugcPending = r.items || []); }
  approveUgc(p: any) { this.admin.w4_approveUgc(p.id).subscribe(() => { this.ok = 'Approuvé'; this.loadUgc(); }); }
  rejectUgc(p: any) { this.admin.w4_rejectUgc(p.id).subscribe(() => { this.ok = 'Rejeté'; this.loadUgc(); }); }

  // Slots
  loadSlots() { this.admin.w4_slots().subscribe(r => this.slots = r.items || []); }
  createSlot() {
    if (!this.newSlot.label) return;
    this.admin.w4_createSlot(this.newSlot).subscribe({
      next: () => { this.ok = 'Créneau créé'; this.loadSlots(); },
      error: () => this.err = 'Erreur'
    });
  }

  // Pickup
  loadPickups() { this.admin.w4_pickups().subscribe(r => this.pickups = r.items || []); }
  createPickup() {
    if (!this.newPickup.name || !this.newPickup.city) return;
    this.admin.w4_createPickup(this.newPickup).subscribe({
      next: () => { this.ok = 'Point ajouté'; this.newPickup = { name: '', address: '', city: '', phone: '', hours: '' }; this.loadPickups(); },
      error: () => this.err = 'Erreur'
    });
  }

  // Insights
  loadLookalikes() { this.admin.w4_lookalikes('VIP').subscribe(r => this.lookalikes = r.items || []); }
  loadStockout() { this.admin.w4_stockoutForecast(7).subscribe(r => this.stockoutForecast = r.items || []); }

  // Export
  exportCsv(resource: string) {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt') || '';
    fetch(this.admin.w4_exportCsvUrl(resource), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${resource}.csv`; a.click();
        URL.revokeObjectURL(url);
        this.ok = 'Téléchargé';
      }).catch(() => this.err = 'Erreur export');
  }

  // Audit
  loadAudit() {
    this.admin.w4_auditDiff({ resource: this.auditResource, resourceId: this.auditResourceId }).subscribe(r => this.auditItems = r.items || []);
  }

  formatDate(d: any): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
