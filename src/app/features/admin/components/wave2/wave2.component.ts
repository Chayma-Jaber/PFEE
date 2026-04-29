import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AdminModuleContextComponent } from '../_shared/admin-module-context.component';

type Tab = 'trending' | 'reorder' | 'images' | 'funnel' | 'canned' | 'synonyms' | 'featured' | 'autocancel' | 'aidesc' | 'tags' | 'scheduled';

@Component({
  selector: 'app-admin-wave2',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminModuleContextComponent],
  templateUrl: './wave2.component.html',
  styleUrls: ['./wave2.component.scss']
})
export class AdminWave2Component implements OnInit {
  tab: Tab = 'trending';
  ok = ''; err = '';

  // Trending
  trending: any[] = []; trendingDays = 7;
  // Reorder
  reorder: any[] = []; reorderThreshold = 15;
  // Images
  imageHealth: any = null;
  // Funnel
  funnel: any = null; funnelDays = 30;
  // Canned
  canned: any[] = []; newCanned = { title: '', body: '', category: 'general' };
  // Synonyms
  synonyms: any[] = []; newSyn = { term: '', synonymsRaw: '' };
  // Featured rotate
  featuredResult: any = null; featuredCount = 6;
  // Auto-cancel
  autoCancelResult: any = null; autoCancelHours = 24;
  // AI description
  aidescProductId: number | null = null; aidescResult: any = null;
  // Tags
  tagProductIds = ''; tagAdd = ''; tagRemove = ''; tagResult: any = null;
  // Scheduled campaigns
  scheduled: any[] = []; scheduleId: number | null = null; scheduleAt = '';

  constructor(private admin: AdminService) {}

  ngOnInit() { this.switch('trending'); }

  switch(t: Tab) {
    this.tab = t; this.ok = ''; this.err = '';
    switch (t) {
      case 'trending': this.loadTrending(); break;
      case 'reorder': this.loadReorder(); break;
      case 'images': this.loadImages(); break;
      case 'funnel': this.loadFunnel(); break;
      case 'canned': this.loadCanned(); break;
      case 'synonyms': this.loadSynonyms(); break;
      case 'scheduled': this.loadScheduled(); break;
    }
  }

  loadTrending() {
    this.admin.w2_trending(this.trendingDays, 12).subscribe(r => this.trending = r.items || []);
  }
  loadReorder() {
    this.admin.w2_reorderSuggestions(this.reorderThreshold).subscribe(r => this.reorder = r.items || []);
  }
  loadImages() {
    this.admin.w2_imageHealth().subscribe(r => this.imageHealth = r);
  }
  loadFunnel() {
    this.admin.w2_funnel(this.funnelDays).subscribe(r => this.funnel = r);
  }
  loadCanned() {
    this.admin.w2_listCanned().subscribe(r => this.canned = r.items || []);
  }
  createCanned() {
    if (!this.newCanned.title || !this.newCanned.body) { this.err = 'Titre + contenu requis'; return; }
    this.admin.w2_createCanned(this.newCanned).subscribe({
      next: () => { this.ok = 'Réponse ajoutée'; this.newCanned = { title: '', body: '', category: 'general' }; this.loadCanned(); },
      error: () => this.err = 'Erreur'
    });
  }
  deleteCanned(c: any) {
    if (!confirm(`Supprimer "${c.title}" ?`)) return;
    this.admin.w2_deleteCanned(c.id).subscribe(() => { this.ok = 'Supprimé'; this.loadCanned(); });
  }
  loadSynonyms() {
    this.admin.w2_listSynonyms().subscribe(r => this.synonyms = r.items || []);
  }
  createSynonym() {
    if (!this.newSyn.term || !this.newSyn.synonymsRaw) { this.err = 'Terme + synonymes requis'; return; }
    const list = this.newSyn.synonymsRaw.split(',').map(s => s.trim()).filter(Boolean);
    this.admin.w2_createSynonym({ term: this.newSyn.term, synonyms: list }).subscribe({
      next: () => { this.ok = 'Synonyme ajouté'; this.newSyn = { term: '', synonymsRaw: '' }; this.loadSynonyms(); },
      error: () => this.err = 'Erreur'
    });
  }
  deleteSynonym(s: any) {
    if (!confirm(`Supprimer "${s.term}" ?`)) return;
    this.admin.w2_deleteSynonym(s.id).subscribe(() => { this.ok = 'Supprimé'; this.loadSynonyms(); });
  }
  rotateFeatured() {
    this.admin.w2_rotateFeatured(this.featuredCount).subscribe({
      next: (r) => { this.featuredResult = r; this.ok = `${r.featured?.length || 0} produits mis en vedette`; },
      error: () => this.err = 'Erreur rotation'
    });
  }
  cancelStale() {
    if (!confirm(`Annuler toutes les commandes PENDING > ${this.autoCancelHours}h ?`)) return;
    this.admin.w2_cancelStale(this.autoCancelHours).subscribe({
      next: (r) => { this.autoCancelResult = r; this.ok = `${r.cancelled} commande(s) annulée(s)`; },
      error: () => this.err = 'Erreur'
    });
  }
  generateDesc() {
    if (!this.aidescProductId) { this.err = 'ID produit requis'; return; }
    this.admin.w2_generateDescription(this.aidescProductId).subscribe({
      next: (r) => { this.aidescResult = r; this.ok = 'Description générée' + (r.persisted ? ' et enregistrée' : ''); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }
  bulkTag() {
    const ids = this.tagProductIds.split(',').map(s => Number(s.trim())).filter(Boolean);
    const addTags = this.tagAdd.split(',').map(s => s.trim()).filter(Boolean);
    const removeTags = this.tagRemove.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) { this.err = 'IDs produits requis'; return; }
    this.admin.w2_bulkTag(ids, addTags, removeTags).subscribe({
      next: (r) => { this.tagResult = r; this.ok = `${r.updated} produits mis à jour`; },
      error: () => this.err = 'Erreur'
    });
  }
  loadScheduled() {
    this.admin.w2_listScheduled().subscribe(r => this.scheduled = r.items || []);
  }
  scheduleCamp() {
    if (!this.scheduleId || !this.scheduleAt) { this.err = 'ID campagne + date requis'; return; }
    this.admin.w2_scheduleCampaign(this.scheduleId, this.scheduleAt).subscribe({
      next: () => { this.ok = 'Campagne planifiée'; this.scheduleId = null; this.scheduleAt = ''; this.loadScheduled(); },
      error: (e) => this.err = e?.error?.message || 'Erreur'
    });
  }

  funnelRows() {
    if (!this.funnel) return [];
    const s = this.funnel.steps || {};
    const max = Math.max(s.VIEW_HOME || 0, s.VIEW_PRODUCT || 0, s.ADD_TO_CART || 0, s.START_CHECKOUT || 0, s.COMPLETE_PURCHASE || 0, 1);
    const row = (label: string, key: string, css: string) => ({
      label, css, count: s[key] || 0,
      pct: Math.round(((s[key] || 0) / max) * 100),
    });
    return [
      row('Visites accueil', 'VIEW_HOME', 's1'),
      row('Vues produit', 'VIEW_PRODUCT', 's2'),
      row('Ajout au panier', 'ADD_TO_CART', 's3'),
      row('Début checkout', 'START_CHECKOUT', 's4'),
      row('Achat complété', 'COMPLETE_PURCHASE', 's5'),
    ];
  }

  urgencyColor(u: string): string {
    return { CRITICAL: '#dc2626', HIGH: '#f59e0b', MEDIUM: '#0ea5e9', LOW: '#9ca3af' }[u] || '#6b7280';
  }
  formatDate(d: any): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
