import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';

type Tab = 'customer360' | 'activity' | 'search' | 'abandoned' | 'stock' | 'csv' | 'campaigns' | 'segments' | 'seo' | 'pricing';

@Component({
  selector: 'app-admin-advanced',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advanced.component.html',
  styleUrls: ['./advanced.component.scss']
})
export class AdminAdvancedComponent implements OnInit {
  tab: Tab = 'customer360';
  successMessage = '';
  errorMessage = '';
  isLoading = false;

  // 1. Customer 360
  c360UserId: number | null = null;
  c360Data: any = null;

  // 2. Activity log
  activityItems: any[] = [];
  activityPage = 1;
  activityPages = 0;
  activityActionFilter = '';

  // 3. Search analytics
  searchAnalytics: any = { totalQueries: 0, topQueries: [], noResultQueries: [] };
  searchDays = 30;

  // 4. Abandoned carts
  abandonedCarts: any[] = [];
  abandonedHours = 24;
  abandonedTotalValue = 0;

  // 5. Stock movements
  stockItems: any[] = [];
  stockPage = 1;
  stockPages = 0;
  stockProductFilter = '';
  // Add stock form
  stockAddProductId: number | null = null;
  stockAddNewStock: number | null = null;
  stockAddReason = 'ADMIN_ADJUSTMENT';
  stockAddNotes = '';

  // 6. CSV
  csvContent = '';
  csvImportResult: any = null;

  // 7. Campaigns
  campaigns: any[] = [];
  campaignForm: any = this.emptyCampaignForm();
  editingCampaign: any = null;

  // 8. Segments
  segments: any = null;

  // 9. SEO
  seoProducts: any[] = [];
  seoCategories: any[] = [];
  seoEditing: any = null;
  seoForm: any = { metaTitle: '', metaDescription: '', keywords: '' };

  // 10. Pricing rules
  pricingRules: any[] = [];
  pricingForm: any = this.emptyPricingForm();
  editingPricing: any = null;

  constructor(private adminService: AdminService) {}

  ngOnInit() { this.switchTab(this.tab); }

  switchTab(t: Tab) {
    this.tab = t;
    switch (t) {
      case 'activity': this.loadActivity(); break;
      case 'search': this.loadSearch(); break;
      case 'abandoned': this.loadAbandoned(); break;
      case 'stock': this.loadStock(); break;
      case 'campaigns': this.loadCampaigns(); break;
      case 'segments': this.loadSegments(); break;
      case 'seo': this.loadSeo(); break;
      case 'pricing': this.loadPricing(); break;
    }
  }

  // ── 1. Customer 360 ─────────────────────────────
  loadCustomer360() {
    if (!this.c360UserId) return;
    this.isLoading = true;
    this.adminService.getCustomer360(this.c360UserId).subscribe({
      next: (d) => { this.c360Data = d; this.isLoading = false; },
      error: () => { this.showError('Client introuvable'); this.isLoading = false; this.c360Data = null; }
    });
  }

  // ── 2. Activity log ─────────────────────────────
  loadActivity() {
    this.adminService.getActivityLog({ page: this.activityPage, limit: 30, action: this.activityActionFilter })
      .subscribe({
        next: (r) => { this.activityItems = r.items || []; this.activityPages = r.pages || 0; },
        error: () => this.showError('Erreur chargement journal')
      });
  }

  // ── 3. Search analytics ─────────────────────────
  loadSearch() {
    this.adminService.getSearchAnalytics(this.searchDays).subscribe({
      next: (d) => this.searchAnalytics = d,
      error: () => this.showError('Erreur analytics recherche')
    });
  }

  // ── 4. Abandoned carts ──────────────────────────
  loadAbandoned() {
    this.adminService.getAbandonedCarts(this.abandonedHours).subscribe({
      next: (r) => { this.abandonedCarts = r.items || []; this.abandonedTotalValue = r.totalValue || 0; },
      error: () => this.showError('Erreur paniers abandonnés')
    });
  }

  sendRecovery(cart: any) {
    const pctStr = prompt(`Envoyer un coupon de réduction à ${cart.email} ?\nEntrez le % de réduction (5-50):`, '10');
    if (!pctStr) return;
    const pct = Math.max(5, Math.min(50, Number(pctStr) || 10));
    this.adminService.sendAbandonedCartRecovery(cart.userId, pct).subscribe({
      next: (r) => this.showSuccess(`Coupon ${r.couponCode} (-${r.discountPercent}%) envoyé à ${cart.email}`),
      error: (e) => this.showError(e?.error?.message || 'Erreur envoi récupération')
    });
  }

  // ── 5. Stock movements ──────────────────────────
  loadStock() {
    this.adminService.getStockMovements({ page: this.stockPage, limit: 30, productId: this.stockProductFilter })
      .subscribe({
        next: (r) => { this.stockItems = r.items || []; this.stockPages = r.pages || 0; },
        error: () => this.showError('Erreur mouvements stock')
      });
  }

  addStock() {
    if (!this.stockAddProductId || this.stockAddNewStock == null) { this.showError('Produit et nouveau stock requis'); return; }
    this.adminService.addStockMovement(this.stockAddProductId, this.stockAddNewStock, this.stockAddReason, this.stockAddNotes)
      .subscribe({
        next: () => { this.showSuccess('Stock mis à jour'); this.loadStock(); this.stockAddProductId = null; this.stockAddNewStock = null; this.stockAddNotes = ''; },
        error: (e) => this.showError(e?.error?.message || 'Erreur')
      });
  }

  // ── 6. CSV ──────────────────────────────────────
  downloadCsv() {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt') || '';
    fetch(this.adminService.exportProductsCsvUrl(), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'products.csv'; a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => this.showError('Erreur export CSV'));
  }

  onCsvFile(evt: any) {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.csvContent = reader.result as string;
    reader.readAsText(file);
  }

  importCsv() {
    if (!this.csvContent.trim()) { this.showError('Collez ou chargez un CSV d\'abord'); return; }
    this.adminService.importProductsCsv(this.csvContent).subscribe({
      next: (r) => { this.csvImportResult = r; this.showSuccess(`${r.imported} créés, ${r.updated} mis à jour`); },
      error: (e) => this.showError(e?.error?.message || 'Erreur import')
    });
  }

  // ── 7. Campaigns ────────────────────────────────
  loadCampaigns() {
    this.adminService.getCampaigns().subscribe({ next: (r) => this.campaigns = r.items || [] });
  }

  saveCampaign() {
    if (!this.campaignForm.name || !this.campaignForm.subject || !this.campaignForm.body) {
      this.showError('Nom, sujet et contenu requis'); return;
    }
    const req = this.editingCampaign
      ? this.adminService.updateCampaign(this.editingCampaign.id, this.campaignForm)
      : this.adminService.createCampaign(this.campaignForm);
    req.subscribe({
      next: () => { this.showSuccess(this.editingCampaign ? 'Campagne mise à jour' : 'Campagne créée'); this.campaignForm = this.emptyCampaignForm(); this.editingCampaign = null; this.loadCampaigns(); },
      error: (e) => this.showError(e?.error?.message || 'Erreur')
    });
  }

  editCampaign(c: any) {
    this.editingCampaign = c;
    this.campaignForm = { name: c.name, subject: c.subject, body: c.body, ctaLabel: c.cta_label, ctaUrl: c.cta_url };
  }

  sendCampaignNow(c: any) {
    if (!confirm(`Envoyer la campagne "${c.name}" à tous les abonnés confirmés ?`)) return;
    this.adminService.sendCampaign(c.id).subscribe({
      next: (r) => { this.showSuccess(`Envoyé à ${r.sent} abonnés`); this.loadCampaigns(); },
      error: (e) => this.showError(e?.error?.message || 'Erreur envoi')
    });
  }

  deleteCampaign(c: any) {
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    this.adminService.deleteCampaignById(c.id).subscribe({
      next: () => { this.showSuccess('Campagne supprimée'); this.loadCampaigns(); },
      error: () => this.showError('Erreur')
    });
  }

  emptyCampaignForm() { return { name: '', subject: '', body: '', ctaLabel: '', ctaUrl: '' }; }

  // ── 8. Segments ─────────────────────────────────
  loadSegments() {
    this.adminService.getSegments().subscribe({ next: (d) => this.segments = d });
  }

  segmentKeys(): string[] {
    return this.segments?.segments ? Object.keys(this.segments.segments) : [];
  }

  // ── 9. SEO ──────────────────────────────────────
  loadSeo() {
    this.adminService.getSeoProducts(1, 50).subscribe({ next: (r) => this.seoProducts = r.items || [] });
    this.adminService.getSeoCategories().subscribe({ next: (r) => this.seoCategories = r.items || [] });
  }

  editSeo(item: any, kind: 'product' | 'category') {
    this.seoEditing = { ...item, _kind: kind };
    this.seoForm = { metaTitle: item.metaTitle || '', metaDescription: item.metaDescription || '', keywords: item.keywords || '' };
  }

  saveSeo() {
    if (!this.seoEditing) return;
    const req = this.seoEditing._kind === 'product'
      ? this.adminService.updateSeoProduct(this.seoEditing.id, this.seoForm)
      : this.adminService.updateSeoCategory(this.seoEditing.id, this.seoForm);
    req.subscribe({
      next: () => { this.showSuccess('SEO mis à jour'); this.seoEditing = null; this.loadSeo(); },
      error: () => this.showError('Erreur SEO')
    });
  }

  // ── 10. Pricing rules ───────────────────────────
  loadPricing() {
    this.adminService.getPricingRules().subscribe({ next: (r) => this.pricingRules = r.items || [] });
  }

  savePricingRule() {
    if (!this.pricingForm.name || !this.pricingForm.ruleType || this.pricingForm.discountValue == null) {
      this.showError('Nom, type et valeur requis'); return;
    }
    const req = this.editingPricing
      ? this.adminService.updatePricingRule(this.editingPricing.id, this.pricingForm)
      : this.adminService.createPricingRule(this.pricingForm);
    req.subscribe({
      next: () => { this.showSuccess('Règle enregistrée'); this.pricingForm = this.emptyPricingForm(); this.editingPricing = null; this.loadPricing(); },
      error: (e) => this.showError(e?.error?.message || 'Erreur')
    });
  }

  editPricingRule(r: any) {
    this.editingPricing = r;
    this.pricingForm = {
      name: r.name, ruleType: r.rule_type,
      discountType: r.discount_type, discountValue: r.discount_value,
      targetType: r.target_type, targetValue: r.target_value,
      minQuantity: r.min_quantity, minAmount: r.min_amount,
      priority: r.priority, isActive: r.is_active
    };
  }

  togglePricing(r: any) {
    this.adminService.togglePricingRule(r.id).subscribe({
      next: (resp) => { r.is_active = resp.isActive; this.showSuccess(r.is_active ? 'Activée' : 'Désactivée'); }
    });
  }

  deletePricing(r: any) {
    if (!confirm(`Supprimer "${r.name}" ?`)) return;
    this.adminService.deletePricingRule(r.id).subscribe({
      next: () => { this.showSuccess('Règle supprimée'); this.loadPricing(); }
    });
  }

  emptyPricingForm() {
    return {
      name: '', ruleType: 'CATEGORY_DISCOUNT',
      discountType: 'percentage', discountValue: 10,
      targetType: 'category', targetValue: '',
      minQuantity: null, minAmount: null,
      priority: 0, isActive: true
    };
  }

  // Helpers
  formatDate(d: any): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  showSuccess(m: string) { this.successMessage = m; this.errorMessage = ''; setTimeout(() => this.successMessage = '', 3000); }
  showError(m: string) { this.errorMessage = m; this.successMessage = ''; setTimeout(() => this.errorMessage = '', 5000); }
}
