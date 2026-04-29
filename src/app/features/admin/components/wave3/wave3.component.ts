import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';

type Tab = 'blocks' | 'abtests' | 'segments' | 'merchandising' | 'shipments';

@Component({
  selector: 'app-admin-wave3',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  templateUrl: './wave3.component.html',
  styleUrls: ['./wave3.component.scss']
})
export class AdminWave3Component implements OnInit {
  tab: Tab = 'blocks';
  ok = ''; err = '';

  // Blocks
  blocks: any[] = [];
  newBlock: any = { key: '', title: '', type: 'products_carousel', position: 99, isActive: true, config: '{"limit":8}' };

  // A/B tests
  tests: any[] = [];
  newTest: any = { key: '', name: '', variantsRaw: 'A|Variant A|50\nB|Variant B|50', goalEvent: 'ADD_TO_CART' };
  selectedResults: any = null;

  // Segments (reuse existing campaigns)
  campaigns: any[] = [];
  segmentSend = { campaignId: null as number | null, segment: 'LOYAL' };

  // Merchandising
  merchCategoryId: number | null = null;
  merchPositions: any[] = [];
  merchNewOrder = '';

  // Shipments
  shipments: any[] = [];
  shipPage = 1; shipPages = 0;
  shipStatusFilter = '';
  newShipment = { orderId: null as number | null, provider: 'FIRST_DELIVERY', weightKg: 1 };
  providers: any[] = [];
  statusPicker: any = { shipmentId: null, status: 'HANDED_OVER', note: '' };

  STATUS_OPTIONS = ['PREPARING','DEPOT_BARSHA','HANDED_OVER','IN_TRANSIT','DEPOT_DELIVERY','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED'];

  constructor(private admin: AdminService) {}

  ngOnInit() { this.switch('blocks'); this.admin.sh_providers().subscribe(r => this.providers = r.providers || []); }

  switch(t: Tab) {
    this.tab = t; this.ok = ''; this.err = '';
    switch (t) {
      case 'blocks': this.loadBlocks(); break;
      case 'abtests': this.loadTests(); break;
      case 'segments': this.loadCampaigns(); break;
      case 'shipments': this.loadShipments(); break;
    }
  }

  // BLOCKS
  loadBlocks() { this.admin.w3_listBlocks().subscribe(r => this.blocks = r.items || []); }
  createBlock() {
    let config: any = {};
    try { config = JSON.parse(this.newBlock.config || '{}'); } catch { this.err = 'JSON invalide'; return; }
    if (!this.newBlock.key || !this.newBlock.title) { this.err = 'key + title requis'; return; }
    this.admin.w3_createBlock({ ...this.newBlock, config }).subscribe({
      next: () => { this.ok = 'Bloc créé'; this.newBlock = { key: '', title: '', type: 'products_carousel', position: 99, isActive: true, config: '{"limit":8}' }; this.loadBlocks(); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }
  toggleBlock(b: any) { this.admin.w3_updateBlock(b.id, { isActive: !b.is_active }).subscribe(() => { b.is_active = !b.is_active; this.ok = 'Mis à jour'; }); }
  deleteBlock(b: any) {
    if (!confirm(`Supprimer bloc "${b.title}" ?`)) return;
    this.admin.w3_deleteBlock(b.id).subscribe(() => { this.ok = 'Supprimé'; this.loadBlocks(); });
  }

  // AB TESTS
  loadTests() { this.admin.w3_listTests().subscribe(r => this.tests = r.items || []); }
  createTest() {
    const variants = this.newTest.variantsRaw.split('\n').map((l: string) => {
      const [id, label, w] = l.split('|').map(s => s.trim());
      return { id, label, weight: Number(w) || 1 };
    }).filter((v: any) => v.id);
    if (!this.newTest.key || !this.newTest.name || variants.length < 2) { this.err = 'key, name, ≥2 variants requis'; return; }
    this.admin.w3_createTest({ key: this.newTest.key, name: this.newTest.name, variants, goalEvent: this.newTest.goalEvent }).subscribe({
      next: () => { this.ok = 'Test créé'; this.newTest = { key: '', name: '', variantsRaw: 'A|Variant A|50\nB|Variant B|50', goalEvent: 'ADD_TO_CART' }; this.loadTests(); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }
  viewResults(t: any) {
    this.admin.w3_testResults(t.key).subscribe(r => this.selectedResults = { ...r, test: r.test || { key: t.key, name: t.name } });
  }

  // SEGMENTS
  loadCampaigns() { this.admin.getCampaigns().subscribe(r => this.campaigns = r.items || []); }
  sendToSegment() {
    if (!this.segmentSend.campaignId) { this.err = 'Campagne requise'; return; }
    this.admin.w3_sendToSegment(this.segmentSend.campaignId, this.segmentSend.segment).subscribe({
      next: (r) => this.ok = `✓ Envoyé à ${r.sent} client(s) du segment ${r.segment}`,
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }

  // MERCHANDISING
  loadMerch() {
    if (!this.merchCategoryId) return;
    this.admin.w3_getMerchandising(this.merchCategoryId).subscribe(r => {
      this.merchPositions = r.positions || [];
      this.merchNewOrder = this.merchPositions.map(p => p.product_id).join(', ');
    });
  }
  reorderMerch() {
    if (!this.merchCategoryId) { this.err = 'Catégorie requise'; return; }
    const ids = this.merchNewOrder.split(',').map(s => Number(s.trim())).filter(Boolean);
    if (ids.length === 0) { this.err = 'IDs requis'; return; }
    this.admin.w3_reorderCategory(this.merchCategoryId, ids).subscribe({
      next: () => { this.ok = 'Ordre mis à jour'; this.loadMerch(); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }

  // SHIPMENTS
  loadShipments() {
    this.admin.sh_list({ page: this.shipPage, limit: 20, status: this.shipStatusFilter }).subscribe(r => {
      this.shipments = r.items || [];
      this.shipPages = r.pages || 0;
    });
  }
  createShipment() {
    if (!this.newShipment.orderId || !this.newShipment.provider) { this.err = 'orderId + provider requis'; return; }
    this.admin.sh_create(this.newShipment.orderId, this.newShipment.provider, this.newShipment.weightKg).subscribe({
      next: (s) => { this.ok = `✓ Expédition créée — ${s.tracking_number}`; this.newShipment = { orderId: null, provider: 'FIRST_DELIVERY', weightKg: 1 }; this.loadShipments(); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }
  syncShipment(s: any) {
    this.admin.sh_sync(s.id).subscribe({
      next: () => { this.ok = '✓ Synchronisé avec le transporteur'; this.loadShipments(); },
      error: () => this.err = 'Erreur sync'
    });
  }
  openStatusPicker(s: any) {
    this.statusPicker = { shipmentId: s.id, status: 'HANDED_OVER', note: '' };
  }
  pushStatus() {
    if (!this.statusPicker.shipmentId) return;
    this.admin.sh_pushStatus(this.statusPicker.shipmentId, this.statusPicker.status, this.statusPicker.note).subscribe({
      next: () => { this.ok = `✓ Statut ${this.statusPicker.status} enregistré`; this.statusPicker = { shipmentId: null, status: 'HANDED_OVER', note: '' }; this.loadShipments(); },
      error: () => this.err = 'Erreur'
    });
  }
  cancelShipment(s: any) {
    if (!confirm(`Annuler l'expédition ${s.tracking_number} ?`)) return;
    this.admin.sh_cancel(s.id).subscribe({
      next: () => { this.ok = 'Annulée'; this.loadShipments(); },
      error: () => this.err = 'Erreur'
    });
  }

  statusBadge(s: string): string {
    if (s === 'DELIVERED') return 'ok';
    if (s === 'FAILED' || s === 'CANCELLED' || s === 'RETURNED') return 'danger';
    if (s === 'OUT_FOR_DELIVERY') return 'progress';
    return 'info';
  }
  providerLabel(k: string): string {
    return this.providers.find(p => p.key === k)?.displayName || k;
  }
  formatDate(d: any): string { return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
}
