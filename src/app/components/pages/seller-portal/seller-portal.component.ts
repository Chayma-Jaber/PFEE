import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environementDev } from '../../../../environements/environementDev';

@Component({
  selector: 'app-seller-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="seller-portal">
      <header class="head">
        <h1><i class="fas fa-store"></i> Espace vendeur</h1>
        <p>Gérez votre profil, votre catalogue, vos commandes et vos virements en un seul endroit.</p>
      </header>

      <div *ngIf="toast" class="toast" [class.ok]="toastKind==='ok'" [class.err]="toastKind==='err'">{{ toast }}</div>
      <div *ngIf="loading" class="state">Chargement…</div>

      <!-- No seller profile yet -->
      <section *ngIf="!loading && !seller" class="card-cta">
        <h2>Devenez vendeur sur Barsha</h2>
        <p class="muted">Vendez vos articles auprès de nos clients. Notre équipe valide votre demande sous 48h ouvrées.</p>
        <div class="form-grid">
          <label>Nom de la société * <input [(ngModel)]="apply.businessName" /></label>
          <label>Email contact * <input type="email" [(ngModel)]="apply.contactEmail" /></label>
          <label>Téléphone <input type="tel" [(ngModel)]="apply.contactPhone" /></label>
          <label>N° fiscal (optionnel) <input [(ngModel)]="apply.vatNumber" /></label>
          <label>Slug souhaité (URL) <input [(ngModel)]="apply.slug" placeholder="ma-boutique" /></label>
          <label>IBAN payouts <input [(ngModel)]="apply.payoutIban" /></label>
          <label class="wide">Description <textarea [(ngModel)]="apply.description" rows="2"></textarea></label>
        </div>
        <button class="btn primary" (click)="submitApply()" [disabled]="applying">
          {{ applying ? '…' : 'Soumettre la demande' }}
        </button>
      </section>

      <section *ngIf="seller && seller.status === 'PENDING'" class="status-card warn">
        <i class="fas fa-hourglass-half"></i>
        <div>
          <strong>Demande en cours d'examen</strong>
          <p>Notre équipe revient vers vous sous 48h ouvrées.</p>
        </div>
      </section>

      <section *ngIf="seller && (seller.status === 'REJECTED' || seller.status === 'SUSPENDED')" class="status-card err">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Profil {{ seller.status === 'REJECTED' ? 'rejeté' : 'suspendu' }}</strong>
          <p>{{ seller.rejection_reason || 'Contactez le support.' }}</p>
        </div>
      </section>

      <ng-container *ngIf="seller && seller.status === 'APPROVED'">
        <div class="profile-bar">
          <div>
            <strong>{{ seller.business_name }}</strong>
            <span class="badge ok">{{ seller.status }}</span>
            <span class="badge indigo">{{ seller.commission_pct }}% commission</span>
            <div class="muted small">/{{ seller.slug }} · {{ seller.contact_email }}</div>
          </div>
        </div>

        <div class="stats-grid" *ngIf="stats">
          <div class="stat-card"><div class="stat-icon indigo"><i class="fas fa-box"></i></div><div><span class="stat-value">{{ stats.total }}</span><span class="stat-label">Produits</span></div></div>
          <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><span class="stat-value">{{ stats.active }}</span><span class="stat-label">Actifs</span></div></div>
          <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-exclamation"></i></div><div><span class="stat-value">{{ stats.lowStock }}</span><span class="stat-label">Stock bas</span></div></div>
          <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><span class="stat-value">{{ stats.outOfStock }}</span><span class="stat-label">Rupture</span></div></div>
          <div class="stat-card" *ngIf="orderStats"><div class="stat-icon teal"><i class="fas fa-coins"></i></div><div><span class="stat-value">{{ orderStats.gross30d | number:'1.0-0' }}</span><span class="stat-label">CA 30j (TND)</span></div></div>
          <div class="stat-card" *ngIf="orderStats"><div class="stat-icon pink"><i class="fas fa-shopping-bag"></i></div><div><span class="stat-value">{{ orderStats.orders30d }}</span><span class="stat-label">Commandes 30j</span></div></div>
        </div>

        <div class="tabs">
          <button class="btn ghost" [class.primary]="tab==='catalog'" (click)="setTab('catalog')">Catalogue</button>
          <button class="btn ghost" [class.primary]="tab==='orders'" (click)="setTab('orders')">Commandes</button>
          <button class="btn ghost" [class.primary]="tab==='payouts'" (click)="setTab('payouts')">Virements</button>
          <button class="btn ghost" [class.primary]="tab==='profile'" (click)="setTab('profile')">Mon profil</button>
        </div>

        <!-- ═══════════ CATALOG TAB ═══════════════════════════════════════ -->
        <section *ngIf="tab==='catalog'">
          <div class="card">
            <h3>{{ editing?.id ? 'Modifier le produit' : 'Ajouter un produit' }}</h3>
            <div class="form-grid">
              <label>SKU (auto-généré si vide) <input [(ngModel)]="form.sku" /></label>
              <label>Titre * <input [(ngModel)]="form.title" /></label>
              <label class="wide">Description <textarea [(ngModel)]="form.description" rows="3"></textarea></label>
              <label>Prix public (TND) * <input type="number" min="0" step="0.001" [(ngModel)]="form.price" /></label>
              <label>Prix promo (TND) <input type="number" min="0" step="0.001" [(ngModel)]="form.currentPrice" /></label>
              <label>Stock initial <input type="number" min="0" [(ngModel)]="form.totalStock" /></label>
              <label>Famille
                <select [(ngModel)]="form.famille">
                  <option value="UNISEX">Unisexe</option><option value="MEN">Homme</option>
                  <option value="WOMEN">Femme</option><option value="KIDS">Enfant</option>
                </select>
              </label>
              <label>Image principale (URL) <input [(ngModel)]="form.firstImageUrl" placeholder="https://…" /></label>
              <label>Actif <select [(ngModel)]="form.isActive"><option [ngValue]="true">Oui</option><option [ngValue]="false">Non (caché)</option></select></label>
            </div>
            <div class="actions">
              <button class="btn primary" (click)="save()" [disabled]="saving">{{ saving ? '…' : (editing?.id ? 'Mettre à jour' : 'Créer le produit') }}</button>
              <button *ngIf="editing?.id" class="btn ghost" (click)="cancelEdit()">Annuler</button>
            </div>
          </div>

          <div class="card">
            <h3>Mes produits ({{ products.length }})</h3>
            <table *ngIf="products.length > 0">
              <thead><tr><th></th><th>SKU</th><th>Titre</th><th>Prix</th><th>Stock</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let p of products">
                  <td><img *ngIf="p.firstImageUrl" [src]="p.firstImageUrl" [alt]="p.title" class="thumb" /></td>
                  <td class="mono small">{{ p.sku }}</td>
                  <td><strong>{{ p.title }}</strong></td>
                  <td>{{ p.currentPrice }} TND</td>
                  <td>
                    <span class="badge" [class.ok]="p.totalStock > 5" [class.warn]="p.totalStock > 0 && p.totalStock <= 5" [class.err]="p.totalStock === 0">{{ p.totalStock }}</span>
                  </td>
                  <td><span class="badge" [class.ok]="p.isActive" [class.idle]="!p.isActive">{{ p.isActive ? 'Actif' : 'Caché' }}</span></td>
                  <td>
                    <button class="btn ghost mini" (click)="edit(p)">Modifier</button>
                    <button class="btn ghost mini" (click)="openDetail(p)"><i class="fas fa-images"></i> Photos / Variantes</button>
                    <button class="btn danger mini" (click)="remove(p)">Désactiver</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="empty" *ngIf="products.length === 0">Aucun produit. Créez le premier ci-dessus.</div>
          </div>

          <!-- ───── PRODUCT DETAIL EDITOR ─────── -->
          <div class="card editor" *ngIf="detail">
            <div class="editor-head">
              <div>
                <h3>{{ detail.product.title }}</h3>
                <div class="muted small mono">{{ detail.product.sku }}</div>
              </div>
              <button class="btn ghost mini" (click)="closeDetail()">✕ Fermer</button>
            </div>

            <div class="editor-tabs">
              <button class="btn ghost mini" [class.primary]="detail.tab==='images'" (click)="detail.tab='images'">Photos ({{ detail.images.length }})</button>
              <button class="btn ghost mini" [class.primary]="detail.tab==='variants'" (click)="detail.tab='variants'">Variantes ({{ detail.variants.length }})</button>
            </div>

            <!-- IMAGES -->
            <div *ngIf="detail.tab==='images'">
              <div class="upload-row">
                <input #fileInput type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" (change)="onFiles($event)" hidden />
                <button class="btn primary" (click)="fileInput.click()" [disabled]="uploading">
                  <i class="fas fa-upload"></i>
                  <ng-container *ngIf="!uploading">Téléverser des images</ng-container>
                  <ng-container *ngIf="uploading">
                    Upload {{ uploadCurrent }}/{{ uploadTotal }} · {{ uploadPct }}%…
                  </ng-container>
                </button>
                <span class="small muted">Plusieurs fichiers possibles · JPG/PNG/WebP/GIF, 5 MB chacun</span>
              </div>
              <div *ngIf="uploadErrors.length > 0" class="upload-errors">
                <strong><i class="fas fa-exclamation-triangle"></i> {{ uploadErrors.length }} erreur(s)</strong>
                <ul><li *ngFor="let e of uploadErrors">{{ e }}</li></ul>
              </div>
              <div class="img-grid" *ngIf="detail.images.length > 0">
                <div class="img-card" *ngFor="let img of detail.images; let i = index">
                  <img [src]="img.imageUrl" [alt]="img.altText || ''" />
                  <div class="img-actions">
                    <span class="small">#{{ i + 1 }}</span>
                    <button class="btn ghost mini" (click)="moveImage(img, -1)" [disabled]="i === 0">↑</button>
                    <button class="btn ghost mini" (click)="moveImage(img, 1)" [disabled]="i === detail.images.length - 1">↓</button>
                    <button class="btn danger mini" (click)="deleteImage(img)">×</button>
                  </div>
                </div>
              </div>
              <div class="empty" *ngIf="detail.images.length === 0">Aucune image. Téléversez la première.</div>
            </div>

            <!-- VARIANTS -->
            <div *ngIf="detail.tab==='variants'">
              <table *ngIf="detail.variants.length > 0">
                <thead><tr><th>Couleur</th><th>Taille</th><th>SKU</th><th>EAN13</th><th>Stock</th><th>Δ Prix</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let v of detail.variants">
                    <td><input [(ngModel)]="v.couleur" (change)="updateVariant(v)" /></td>
                    <td><input [(ngModel)]="v.taille" (change)="updateVariant(v)" /></td>
                    <td><input [(ngModel)]="v.sku" (change)="updateVariant(v)" class="mono" /></td>
                    <td><input [(ngModel)]="v.ean13" (change)="updateVariant(v)" class="mono" maxlength="13" /></td>
                    <td><input type="number" min="0" [(ngModel)]="v.stock" (change)="updateVariant(v)" style="width:70px" /></td>
                    <td><input type="number" step="0.001" [(ngModel)]="v.priceAdjust" (change)="updateVariant(v)" style="width:80px" /></td>
                    <td><button class="btn danger mini" (click)="deleteVariant(v)">×</button></td>
                  </tr>
                </tbody>
              </table>
              <div class="empty" *ngIf="detail.variants.length === 0">Aucune variante. Ajoutez la première ci-dessous.</div>

              <h4 class="sub-h">Ajouter une variante</h4>
              <div class="form-grid">
                <label>Couleur <input [(ngModel)]="newVariant.couleur" /></label>
                <label>Taille <input [(ngModel)]="newVariant.taille" /></label>
                <label>SKU <input [(ngModel)]="newVariant.sku" /></label>
                <label>EAN13 (8–13 chiffres) <input [(ngModel)]="newVariant.ean13" maxlength="13" /></label>
                <label>Stock <input type="number" min="0" [(ngModel)]="newVariant.stock" /></label>
                <label>Ajustement prix (TND) <input type="number" step="0.001" [(ngModel)]="newVariant.priceAdjust" /></label>
              </div>
              <div class="actions">
                <button class="btn primary" (click)="addVariant()">Ajouter</button>
              </div>
              <p class="small muted" style="margin-top:8px"><i class="fas fa-info-circle"></i> Dès qu'une variante est ajoutée, le stock total du produit est calculé automatiquement à partir des variantes.</p>

              <h4 class="sub-h">Import CSV en masse</h4>
              <p class="small muted" style="margin:0 0 8px">
                Header attendu : <span class="mono">couleur,taille,sku,ean13,stock,priceAdjust</span>.
                Les variantes existantes sont mises à jour par SKU ou EAN13. 500 lignes max par import.
              </p>
              <textarea [(ngModel)]="csvInput" rows="6" class="csv-area"
                placeholder="couleur,taille,sku,ean13,stock,priceAdjust&#10;Noir,M,SKU-NM,1234567890123,15,0&#10;Bleu,L,SKU-BL,1234567890124,8,5"></textarea>
              <div class="actions">
                <button class="btn primary" (click)="importCsv()" [disabled]="csvImporting || !csvInput.trim()">
                  <i class="fas fa-file-import"></i> {{ csvImporting ? 'Import…' : 'Importer le CSV' }}
                </button>
                <button class="btn ghost" (click)="copyCsvSample()">Copier un exemple</button>
              </div>
              <div *ngIf="csvReport" class="csv-report" [class.has-errors]="csvReport.skipped > 0">
                <strong>Résultat :</strong>
                {{ csvReport.created }} créées · {{ csvReport.updated }} mises à jour · {{ csvReport.skipped }} ignorées sur {{ csvReport.total }}
                <ul *ngIf="csvReport.errors?.length" class="csv-errors">
                  <li *ngFor="let e of csvReport.errors">Ligne {{ e.line }} : {{ e.reason }}</li>
                </ul>
                <div *ngIf="csvReport.errors?.length" class="actions" style="margin-top:8px">
                  <button class="btn ghost mini" (click)="downloadFailedRows()">
                    <i class="fas fa-file-download"></i> Télécharger les lignes en erreur
                  </button>
                  <button class="btn ghost mini" (click)="loadFailedIntoTextarea()">
                    <i class="fas fa-undo"></i> Recharger les lignes en erreur dans la zone
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══════════ ORDERS TAB ═══════════════════════════════════════ -->
        <section *ngIf="tab==='orders'" class="card">
          <h3>Commandes contenant mes produits</h3>
          <div class="filters">
            <select [(ngModel)]="orderFilter" (change)="loadOrders()">
              <option value="">Tous statuts</option>
              <option value="CONFIRMED">Confirmées</option>
              <option value="PROCESSING">En préparation</option>
              <option value="SHIPPED">Expédiées</option>
              <option value="DELIVERED">Livrées</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          <div *ngIf="orders.length === 0" class="empty">Aucune commande pour ce filtre.</div>
          <div class="order-list" *ngIf="orders.length > 0">
            <div class="order-row" *ngFor="let o of orders">
              <div class="order-head">
                <strong>{{ o.reference || ('Commande #' + o.orderId) }}</strong>
                <span class="badge"
                  [class.ok]="o.status==='DELIVERED' || o.status==='COMPLETED'"
                  [class.warn]="['CONFIRMED','PROCESSING','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','PAYMENT_PENDING','PARTIALLY_SHIPPED','PARTIALLY_DELIVERED'].includes(o.status)"
                  [class.err]="['CANCELLED','FAILED','REFUNDED'].includes(o.status)"
                  [class.idle]="['PENDING','READY','DRAFT'].includes(o.status)">
                  {{ statusLabel(o.status) }}
                </span>
                <span class="small muted">{{ formatDate(o.createdAt) }}</span>
                <span class="grow"></span>
                <strong class="ca">{{ o.sellerSubtotal }} TND</strong>
              </div>
              <ul class="order-items">
                <li *ngFor="let it of o.items">
                  <img *ngIf="it.image" [src]="it.image" [alt]="it.title" class="ord-thumb" />
                  <div class="ord-line">
                    <div class="ord-line-top">
                      <span>{{ it.title }} × {{ it.quantity }}</span>
                      <span *ngIf="it.variantInfo" class="small muted">{{ it.variantInfo | json }}</span>
                      <span class="grow"></span>
                      <span class="ord-line-total">{{ it.lineTotal | number:'1.3-3' }} TND</span>
                    </div>
                    <div class="ord-line-fulfill">
                      <span class="badge"
                        [class.idle]="it.fulfillment.status==='PENDING'"
                        [class.warn]="it.fulfillment.status==='PREPARING'"
                        [class.indigo]="it.fulfillment.status==='SHIPPED'"
                        [class.ok]="it.fulfillment.status==='DELIVERED'"
                        [class.err]="it.fulfillment.status==='CANCELLED'">
                        {{ statusLabel(it.fulfillment.status) }}
                      </span>
                      <span *ngIf="it.fulfillment.trackingNumber" class="small mono">
                        <i class="fas fa-truck"></i> {{ it.fulfillment.carrier || 'Tracking' }} {{ it.fulfillment.trackingNumber }}
                      </span>
                      <span class="grow"></span>

                      <button *ngIf="it.fulfillment.status==='PENDING'"
                              class="btn ghost mini" (click)="prepareItem(it)">Préparer</button>
                      <button *ngIf="['PENDING','PREPARING'].includes(it.fulfillment.status)"
                              class="btn primary mini" (click)="openShip(it)">Expédier</button>
                      <button *ngIf="it.fulfillment.status==='SHIPPED'"
                              class="btn primary mini" (click)="markDelivered(it)">Marquer livré</button>
                      <button *ngIf="['PENDING','PREPARING'].includes(it.fulfillment.status)"
                              class="btn danger mini" (click)="cancelItem(it)">Annuler</button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Ship modal -->
        <div *ngIf="shipping" class="modal-backdrop" (click)="closeShip()">
          <div class="ship-modal" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3><i class="fas fa-truck"></i> Expédier l'article</h3>
              <button class="modal-close" (click)="closeShip()">×</button>
            </div>
            <p class="small muted" style="margin:0 0 14px">{{ shipping.title }} × {{ shipping.quantity }}</p>
            <div class="form-grid">
              <label>Transporteur
                <select [(ngModel)]="shipForm.carrier">
                  <option [ngValue]="null">— Choisir —</option>
                  <option value="First Delivery">First Delivery</option>
                  <option value="Aramex">Aramex</option>
                  <option value="DHL">DHL</option>
                  <option value="Fedex">Fedex</option>
                  <option value="La Poste TN">La Poste Tunisienne</option>
                  <option value="Internal">Coursier interne</option>
                  <option value="Other">Autre</option>
                </select>
              </label>
              <label>N° de suivi <input [(ngModel)]="shipForm.trackingNumber" placeholder="ex: 1Z999AA10123456784" /></label>
              <label class="wide">URL de suivi (optionnel) <input type="url" [(ngModel)]="shipForm.trackingUrl" placeholder="https://…" /></label>
              <label class="wide">Notes (optionnel) <textarea [(ngModel)]="shipForm.notes" rows="2" maxlength="500"></textarea></label>
            </div>
            <div *ngIf="shipError" class="toast err" style="margin-top:10px">{{ shipError }}</div>
            <div class="actions" style="margin-top:14px">
              <button class="btn primary" (click)="confirmShip()" [disabled]="shipSaving">
                <i class="fas fa-check"></i> {{ shipSaving ? 'Envoi…' : 'Confirmer expédition' }}
              </button>
              <button class="btn ghost" (click)="closeShip()" [disabled]="shipSaving">Annuler</button>
            </div>
          </div>
        </div>

        <!-- ═══════════ PAYOUTS TAB ══════════════════════════════════════ -->
        <section *ngIf="tab==='payouts'" class="card">
          <h3>Mes virements</h3>
          <table *ngIf="payouts.length > 0">
            <thead><tr><th>Période</th><th>Brut</th><th>Commission</th><th>Net</th><th>Cmd.</th><th>Statut</th><th>Réf. virement</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of payouts">
                <td class="small">{{ formatDate(p.period_start) }} → {{ formatDate(p.period_end) }}</td>
                <td>{{ p.gross_sales }}</td>
                <td>−{{ p.commission_amount }}</td>
                <td><strong>{{ p.net_payout }} TND</strong></td>
                <td>{{ p.order_count }}</td>
                <td><span class="badge" [class.ok]="p.status==='PAID'" [class.warn]="p.status==='PENDING'">{{ p.status }}</span></td>
                <td class="mono small">{{ p.payment_reference || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="empty" *ngIf="payouts.length === 0">Aucun virement à ce jour.</div>
        </section>

        <!-- ═══════════ PROFILE TAB ══════════════════════════════════════ -->
        <section *ngIf="tab==='profile'" class="card">
          <h3>Profil de la boutique</h3>
          <p class="small muted" style="margin:-6px 0 14px">
            Modifiable à tout moment. Le statut, le taux de commission et l'IBAN
            de virement ne peuvent être changés que par le support — contactez-nous si besoin.
          </p>
          <div class="form-grid">
            <label>Nom commercial <input [(ngModel)]="profile.business_name" /></label>
            <label>Raison sociale (legal) <input [(ngModel)]="profile.legal_name" /></label>
            <label>N° fiscal / VAT <input [(ngModel)]="profile.vat_number" /></label>
            <label>Email contact <input type="email" [(ngModel)]="profile.contact_email" /></label>
            <label>Téléphone <input type="tel" [(ngModel)]="profile.contact_phone" /></label>
            <label>Logo (URL) <input [(ngModel)]="profile.logo_url" placeholder="https://…" /></label>
            <label class="wide">Description publique <textarea [(ngModel)]="profile.description" rows="3" maxlength="500"></textarea></label>
          </div>
          <div class="readonly-block">
            <div><strong>Slug boutique :</strong> <span class="mono">/{{ seller?.slug }}</span> <span class="small muted">(non modifiable)</span></div>
            <div><strong>Statut :</strong> <span class="badge ok">{{ seller?.status }}</span></div>
            <div><strong>Commission marketplace :</strong> {{ seller?.commission_pct }}% <span class="small muted">(fixée par le support)</span></div>
            <div *ngIf="seller?.payout_iban"><strong>IBAN payouts :</strong> <span class="mono">…{{ seller.payout_iban.slice(-4) }}</span> <span class="small muted">(masqué — contactez le support pour modifier)</span></div>
          </div>
          <div *ngIf="profileToast" class="toast" style="margin-top:14px"
               [class.ok]="profileToastKind==='ok'" [class.err]="profileToastKind==='err'">{{ profileToast }}</div>
          <div class="actions">
            <button class="btn primary" (click)="saveProfile()" [disabled]="profileSaving">
              <i class="fas fa-save"></i> {{ profileSaving ? 'Enregistrement…' : 'Enregistrer mon profil' }}
            </button>
            <button class="btn ghost" (click)="resetProfileForm()" [disabled]="profileSaving">Annuler</button>
          </div>
        </section>
      </ng-container>
    </div>
  `,
  styles: [`
    .seller-portal { max-width: 1200px; margin: 0 auto; padding: 22px; }
    .head h1 { font-size: 26px; color: #111827; margin: 0 0 4px; }
    .head h1 i { color: #6366f1; margin-right: 8px; }
    .head p { color: #6b7280; margin: 0 0 22px; }
    .toast { padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 13px; }
    .toast.ok { background: #d1fae5; color: #065f46; }
    .toast.err { background: #fee2e2; color: #991b1b; }
    .state { padding: 60px; text-align: center; color: #6b7280; }
    .muted { color: #6b7280; }
    .small { font-size: 12px; }
    .card-cta, .status-card, .profile-bar, .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; margin-bottom: 14px; }
    .card-cta h2 { margin: 0 0 6px; }
    .card h3 { margin: 0 0 12px; font-size: 16px; color: #111827; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
    .form-grid .wide { grid-column: 1 / -1; }
    .form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6b7280; }
    .form-grid input, .form-grid select, .form-grid textarea { padding: 9px 11px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 14px; font-family: inherit; }
    .status-card { display: flex; gap: 14px; align-items: center; }
    .status-card.warn { background: #fffbeb; border-color: #fde68a; }
    .status-card.err { background: #fef2f2; border-color: #fca5a5; }
    .status-card i { font-size: 24px; color: #f59e0b; }
    .status-card.err i { color: #ef4444; }
    .status-card strong { display: block; color: #111827; }
    .status-card p { margin: 4px 0 0; color: #4b5563; font-size: 13px; }
    .profile-bar strong { font-size: 18px; color: #111827; margin-right: 8px; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 9px; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.indigo { background: #eef2ff; color: #4f46e5; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.err { background: #fee2e2; color: #991b1b; }
    .badge.idle { background: #e5e7eb; color: #4b5563; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; display: flex; gap: 12px; align-items: center; }
    .stat-icon { width: 38px; height: 38px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.indigo { background: #eef2ff; color: #6366f1; }
    .stat-icon.green { background: #d1fae5; color: #10b981; }
    .stat-icon.amber { background: #fef3c7; color: #f59e0b; }
    .stat-icon.red { background: #fee2e2; color: #ef4444; }
    .stat-icon.teal { background: #ccfbf1; color: #0d9488; }
    .stat-icon.pink { background: #fce7f3; color: #ec4899; }
    .stat-value { display: block; font-size: 20px; font-weight: 700; color: #111827; }
    .stat-label { font-size: 11px; color: #6b7280; }
    .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .btn { padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db; background: #fff; }
    .btn.primary { background: #111; color: #fff; border-color: #111; }
    .btn.ghost { background: transparent; color: #4b5563; }
    .btn.danger { background: transparent; color: #dc2626; border-color: #fca5a5; }
    .btn.mini { padding: 5px 10px; font-size: 11px; margin-right: 4px; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .actions { display: flex; gap: 8px; }
    .filters { display: flex; gap: 8px; margin-bottom: 12px; }
    .filters select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; background: #f9fafb; padding: 9px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #374151; }
    td { padding: 10px 9px; border-bottom: 1px solid #f3f4f6; }
    .thumb { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
    .mono { font-family: 'Courier New', monospace; }
    .empty { text-align: center; padding: 32px; color: #6b7280; }

    .editor { border: 2px solid #6366f1; }
    .editor-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .editor-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
    .upload-row { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }
    .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .img-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .img-card img { width: 100%; height: 130px; object-fit: cover; display: block; }
    .img-actions { display: flex; align-items: center; gap: 4px; padding: 6px 8px; background: #f9fafb; }
    .img-actions .small { flex: 1; color: #6b7280; }
    .sub-h { font-size: 13px; color: #374151; margin: 16px 0 8px; }

    .order-list { display: flex; flex-direction: column; gap: 10px; }
    .order-row { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
    .order-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .order-head strong { font-size: 14px; }
    .grow { flex: 1; }
    .ca { color: #ec4899; font-size: 14px; }
    .order-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .order-items li { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; border-top: 1px dashed #f3f4f6; }
    .ord-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 5px; }
    .readonly-block { background: #f9fafb; border: 1px dashed #e5e7eb; border-radius: 10px;
                      padding: 14px 16px; margin: 14px 0; display: flex; flex-direction: column; gap: 6px;
                      font-size: 13px; color: #374151; }
    .ord-line { flex: 1; min-width: 0; }
    .ord-line-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ord-line-total { font-weight: 600; color: #111827; }
    .ord-line-fulfill { display: flex; gap: 6px; align-items: center; margin-top: 6px; flex-wrap: wrap; padding-top: 4px; border-top: 1px dashed #f3f4f6; }
    .ord-line-fulfill .badge.indigo { background: #eef2ff; color: #4f46e5; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(17,24,39,0.6); z-index: 100;
                      display: flex; align-items: center; justify-content: center; padding: 20px; }
    .ship-modal { background: #fff; border-radius: 14px; padding: 22px 24px; max-width: 520px; width: 100%;
                  box-shadow: 0 30px 80px rgba(0,0,0,.35); }
    .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .modal-head h3 { margin: 0; }
    .modal-head h3 i { color: #ec4899; margin-right: 6px; }
    .modal-close { background: transparent; border: none; font-size: 28px; line-height: 1; cursor: pointer; color: #6b7280; }
    .upload-errors { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 8px;
                     padding: 10px 14px; margin: 10px 0; font-size: 12px; }
    .upload-errors strong { display: block; margin-bottom: 6px; }
    .upload-errors strong i { margin-right: 6px; }
    .upload-errors ul { margin: 0; padding-left: 18px; }
    .csv-area { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
                font-family: 'Courier New', monospace; font-size: 12px; resize: vertical; box-sizing: border-box; }
    .csv-report { background: #d1fae5; color: #065f46; border-radius: 8px; padding: 10px 14px;
                  margin-top: 10px; font-size: 13px; }
    .csv-report.has-errors { background: #fef3c7; color: #92400e; }
    .csv-errors { margin: 6px 0 0; padding-left: 18px; font-size: 11px; max-height: 200px; overflow-y: auto; }
  `]
})
export class SellerPortalComponent implements OnInit {
  loading = false;
  applying = false;
  saving = false;
  uploading = false;
  uploadPct = 0;
  uploadCurrent = 0; // file index in batch
  uploadTotal = 0;   // batch size
  uploadErrors: string[] = [];
  seller: any = null;
  stats: any = null;
  orderStats: any = null;
  products: any[] = [];
  payouts: any[] = [];
  orders: any[] = [];
  orderFilter = '';
  tab: 'catalog'|'orders'|'payouts'|'profile' = 'catalog';
  editing: any = null;
  toast = ''; toastKind: 'ok'|'err' = 'ok';

  // Profile editing
  profile: any = { business_name: '', legal_name: '', vat_number: '', contact_email: '', contact_phone: '', logo_url: '', description: '' };
  profileSaving = false;
  profileToast = ''; profileToastKind: 'ok'|'err' = 'ok';

  // Fulfillment / ship modal
  shipping: any = null; // the order item being shipped
  shipForm: any = { carrier: null, trackingNumber: '', trackingUrl: '', notes: '' };
  shipSaving = false;
  shipError = '';

  // CSV variant import
  csvInput = '';
  csvImporting = false;
  csvReport: any = null;

  apply: any = { businessName: '', contactEmail: '', contactPhone: '', vatNumber: '', slug: '', description: '', payoutIban: '' };
  form: any = this.emptyForm();

  // Per-product editor state
  detail: { product: any; tab: 'images'|'variants'; images: any[]; variants: any[] } | null = null;
  newVariant: any = this.emptyVariant();

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  private headers(): Record<string, string> {
    const t = localStorage.getItem('jwt');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  private emptyForm(): any {
    return { sku: '', title: '', description: '', price: null, currentPrice: null, totalStock: 0, famille: 'UNISEX', firstImageUrl: '', isActive: true };
  }
  private emptyVariant(): any {
    return { couleur: '', taille: '', sku: '', ean13: '', stock: 0, priceAdjust: 0 };
  }

  load() {
    this.loading = true;
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/me`, { headers: this.headers() })
      .subscribe({
        next: r => {
          this.seller = r?.seller || null;
          this.loading = false;
          if (this.seller?.status === 'APPROVED') {
            this.loadStats(); this.loadOrderStats(); this.loadProducts();
          }
        },
        error: () => { this.seller = null; this.loading = false; }
      });
  }

  setTab(t: 'catalog'|'orders'|'payouts'|'profile') {
    this.tab = t;
    if (t === 'orders') this.loadOrders();
    if (t === 'payouts') this.loadPayouts();
    if (t === 'profile') this.resetProfileForm();
  }

  // ─── Profile editing ─────────────────────────────────────────────
  resetProfileForm() {
    if (!this.seller) return;
    // Only seed editable fields. Protected fields (status, commission_pct, slug,
    // payout_iban, etc.) stay on this.seller and are read-only in the UI.
    this.profile = {
      business_name: this.seller.business_name || '',
      legal_name: this.seller.legal_name || '',
      vat_number: this.seller.vat_number || '',
      contact_email: this.seller.contact_email || '',
      contact_phone: this.seller.contact_phone || '',
      logo_url: this.seller.logo_url || '',
      description: this.seller.description || '',
    };
    this.profileToast = '';
  }

  saveProfile() {
    if (!this.profile.business_name?.trim() || !this.profile.contact_email?.trim()) {
      this.showProfileToast('Nom commercial + email requis', 'err'); return;
    }
    this.profileSaving = true;
    this.http.put<any>(`${environementDev.api}/api/storefront/seller/me`, this.profile, { headers: this.headers() })
      .subscribe({
        next: r => {
          this.profileSaving = false;
          // Backend returns the saved seller directly
          this.seller = r?.data || r;
          this.resetProfileForm();
          this.showProfileToast('Profil enregistré ✓', 'ok');
        },
        error: e => {
          this.profileSaving = false;
          this.showProfileToast(e?.error?.message || 'Erreur', 'err');
        }
      });
  }

  private showProfileToast(m: string, k: 'ok'|'err') {
    this.profileToast = m; this.profileToastKind = k;
    setTimeout(() => this.profileToast = '', 4000);
  }

  submitApply() {
    if (!this.apply.businessName || !this.apply.contactEmail) { this.show('Société + email requis', 'err'); return; }
    this.applying = true;
    this.http.post(`${environementDev.api}/api/storefront/seller/apply`, this.apply, { headers: this.headers() })
      .subscribe({
        next: () => { this.applying = false; this.show('Demande envoyée. Vous serez notifié·e par email.', 'ok'); this.load(); },
        error: e => { this.applying = false; this.show(e?.error?.message || 'Erreur', 'err'); }
      });
  }

  loadStats() {
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/stats`, { headers: this.headers() })
      .subscribe({ next: r => this.stats = r, error: () => this.stats = null });
  }

  loadOrderStats() {
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/orders/stats`, { headers: this.headers() })
      .subscribe({ next: r => this.orderStats = r, error: () => this.orderStats = null });
  }

  loadProducts() {
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/products`, { headers: this.headers() })
      .subscribe({ next: r => this.products = r.items || [], error: () => this.products = [] });
  }

  loadOrders() {
    const qs = this.orderFilter ? `?status=${this.orderFilter}` : '';
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/orders${qs}`, { headers: this.headers() })
      .subscribe({ next: r => this.orders = r.items || [], error: () => this.orders = [] });
  }

  loadPayouts() {
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/me/payouts`, { headers: this.headers() })
      .subscribe({ next: r => this.payouts = r.items || [], error: () => this.payouts = [] });
  }

  // ─── Product CRUD ────────────────────────────────────────────────
  edit(p: any) { this.editing = p; this.form = { ...p }; this.detail = null; window.scrollTo({ top: 200, behavior: 'smooth' }); }
  cancelEdit() { this.editing = null; this.form = this.emptyForm(); }

  save() {
    if (!this.form.title || !this.form.price) { this.show('Titre + prix requis', 'err'); return; }
    if (!this.form.currentPrice) this.form.currentPrice = this.form.price;
    this.saving = true;
    const req = this.editing?.id
      ? this.http.put(`${environementDev.api}/api/storefront/seller/catalog/products/${this.editing.id}`, this.form, { headers: this.headers() })
      : this.http.post(`${environementDev.api}/api/storefront/seller/catalog/products`, this.form, { headers: this.headers() });
    req.subscribe({
      next: () => { this.saving = false; this.show(this.editing?.id ? 'Produit mis à jour' : 'Produit créé', 'ok'); this.cancelEdit(); this.loadStats(); this.loadProducts(); },
      error: e => { this.saving = false; this.show(e?.error?.message || 'Erreur', 'err'); }
    });
  }

  remove(p: any) {
    if (!confirm(`Désactiver "${p.title}" ?`)) return;
    this.http.delete(`${environementDev.api}/api/storefront/seller/catalog/products/${p.id}`, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Produit désactivé', 'ok'); this.loadStats(); this.loadProducts(); } });
  }

  // ─── Per-product editor ──────────────────────────────────────────
  openDetail(p: any) {
    this.editing = null;
    this.detail = { product: p, tab: 'images', images: [], variants: [] };
    this.loadImages();
    this.loadVariants();
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 80);
  }
  closeDetail() { this.detail = null; }

  loadImages() {
    if (!this.detail) return;
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/images`, { headers: this.headers() })
      .subscribe({ next: r => { if (this.detail) this.detail.images = r.items || []; } });
  }

  loadVariants() {
    if (!this.detail) return;
    this.http.get<any>(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/variants`, { headers: this.headers() })
      .subscribe({ next: r => { if (this.detail) this.detail.variants = r.items || []; } });
  }

  // ─── Image upload + ordering ────────────────────────────────────
  // Multi-file upload: walk the FileList sequentially so we don't blow the
  // server's connection budget. Per-file errors are collected and shown.
  // Sequential (not parallel) keeps the progress bar meaningful — uploadPct
  // reflects the *current* file's bytes; uploadCurrent/uploadTotal show batch progress.
  onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input?.files || []);
    if (!files.length || !this.detail) { input.value = ''; return; }
    this.uploadErrors = [];
    this.uploading = true;
    this.uploadTotal = files.length;
    this.uploadCurrent = 0;
    this.uploadPct = 0;

    const productId = this.detail.product.id;
    const next = (queue: File[]): void => {
      if (queue.length === 0) {
        this.uploading = false;
        this.uploadPct = 0;
        const successCount = files.length - this.uploadErrors.length;
        if (successCount > 0) this.show(`${successCount} image(s) ajoutée(s)`, 'ok');
        if (this.uploadErrors.length === files.length) this.show('Aucun fichier n\'a pu être téléversé', 'err');
        this.loadImages();
        this.loadProducts();
        input.value = '';
        return;
      }
      const file = queue.shift()!;
      this.uploadCurrent++;
      this.uploadPct = 0;

      // Client-side guards (mirror what the server enforces — fail-fast UX).
      if (file.size > 5 * 1024 * 1024) {
        this.uploadErrors.push(`${file.name} : dépasse 5 MB`);
        next(queue); return;
      }
      if (!/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
        this.uploadErrors.push(`${file.name} : format non supporté`);
        next(queue); return;
      }

      const fd = new FormData();
      fd.append('file', file);
      this.http.post(`${environementDev.api}/api/upload`, fd, {
        headers: this.headers(), reportProgress: true, observe: 'events',
      }).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadPct = Math.round((100 * event.loaded) / event.total);
          }
          if (event.type === HttpEventType.Response) {
            const url = event.body?.url;
            if (!url) { this.uploadErrors.push(`${file.name} : réponse vide`); next(queue); return; }
            this.http.post(`${environementDev.api}/api/storefront/seller/catalog/products/${productId}/images`,
              { imageUrl: url, altText: file.name.replace(/\.[^.]+$/, '').slice(0, 255) },
              { headers: this.headers() }
            ).subscribe({
              next: () => next(queue),
              error: e => { this.uploadErrors.push(`${file.name} : ${e?.error?.message || 'erreur DB'}`); next(queue); }
            });
          }
        },
        error: () => { this.uploadErrors.push(`${file.name} : upload échoué`); next(queue); }
      });
    };
    next(files);
  }

  deleteImage(img: any) {
    if (!this.detail) return;
    this.http.delete(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/images/${img.id}`, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Supprimée', 'ok'); this.loadImages(); this.loadProducts(); } });
  }

  moveImage(img: any, dir: -1 | 1) {
    if (!this.detail) return;
    const arr = [...this.detail.images];
    const idx = arr.findIndex(x => x.id === img.id);
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    this.detail.images = arr;
    const orderedIds = arr.map(x => x.id);
    this.http.post(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/images/reorder`,
      { orderedIds }, { headers: this.headers() }
    ).subscribe({ next: () => this.loadProducts() });
  }

  // ─── Variants ────────────────────────────────────────────────────
  addVariant() {
    if (!this.detail) return;
    if ((this.newVariant.ean13 || '').length > 0 && !/^\d{8,13}$/.test(this.newVariant.ean13)) {
      this.show('EAN13 doit contenir 8 à 13 chiffres', 'err'); return;
    }
    this.http.post(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/variants`,
      this.newVariant, { headers: this.headers() }
    ).subscribe({
      next: () => { this.show('Variante ajoutée', 'ok'); this.newVariant = this.emptyVariant(); this.loadVariants(); this.loadProducts(); },
      error: e => this.show(e?.error?.message || 'Erreur', 'err')
    });
  }

  updateVariant(v: any) {
    if (!this.detail) return;
    this.http.put(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/variants/${v.id}`,
      { couleur: v.couleur, taille: v.taille, sku: v.sku, ean13: v.ean13, stock: v.stock, priceAdjust: v.priceAdjust },
      { headers: this.headers() }
    ).subscribe({
      next: () => this.loadProducts(),
      error: e => this.show(e?.error?.message || 'Erreur sauvegarde', 'err')
    });
  }

  deleteVariant(v: any) {
    if (!this.detail) return;
    if (!confirm('Supprimer cette variante ?')) return;
    this.http.delete(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/variants/${v.id}`, { headers: this.headers() })
      .subscribe({ next: () => { this.show('Supprimée', 'ok'); this.loadVariants(); this.loadProducts(); } });
  }

  // ─── Bulk CSV import ────────────────────────────────────────────
  importCsv() {
    if (!this.detail || !this.csvInput.trim()) return;
    this.csvImporting = true;
    this.csvReport = null;
    this.http.post<any>(`${environementDev.api}/api/storefront/seller/catalog/products/${this.detail.product.id}/variants/import`,
      { csv: this.csvInput }, { headers: this.headers() }
    ).subscribe({
      next: r => {
        this.csvImporting = false;
        this.csvReport = r;
        if (r.skipped === 0) this.csvInput = '';
        this.loadVariants();
        this.loadProducts();
        this.show(`${r.created + r.updated} variante(s) importée(s)`, r.skipped > 0 ? 'err' : 'ok');
      },
      error: e => {
        this.csvImporting = false;
        this.show(e?.error?.message || 'Erreur import', 'err');
      }
    });
  }

  copyCsvSample() {
    const sample = `couleur,taille,sku,ean13,stock,priceAdjust
Noir,S,SKU-NS,1234567890123,10,0
Noir,M,SKU-NM,1234567890124,15,0
Bleu,L,SKU-BL,1234567890125,8,5`;
    this.csvInput = sample;
    this.show('Exemple copié dans la zone de texte', 'ok');
  }

  // Extract the rows referenced in the report's error list from the original
  // csvInput buffer. Rows are 1-indexed in the report (line 2 = first data row).
  // Used by the two helper buttons below: download-only or reload-into-textarea.
  private getFailedRows(): { header: string; rows: string[] } | null {
    if (!this.csvReport?.errors?.length || !this.csvInput) return null;
    const lines = this.csvInput.replace(/\r\n?/g, '\n').split('\n');
    const header = lines[0] || 'couleur,taille,sku,ean13,stock,priceAdjust';
    const failedLineNumbers = new Set<number>(this.csvReport.errors.map((e: any) => Number(e.line)));
    const rows: string[] = [];
    // Lines in the report are 1-based and account for the header.
    // Line 2 = lines[1] = first data row.
    for (let i = 1; i < lines.length; i++) {
      if (failedLineNumbers.has(i + 1) && lines[i].trim().length > 0) {
        rows.push(lines[i]);
      }
    }
    return { header, rows };
  }

  downloadFailedRows() {
    const out = this.getFailedRows();
    if (!out || out.rows.length === 0) { this.show('Aucune ligne à télécharger', 'err'); return; }
    const csv = out.header + '\n' + out.rows.join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variants-errors-${this.detail?.product?.id || 'all'}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.show(`${out.rows.length} ligne(s) téléchargée(s)`, 'ok');
  }

  loadFailedIntoTextarea() {
    const out = this.getFailedRows();
    if (!out || out.rows.length === 0) { this.show('Aucune ligne à recharger', 'err'); return; }
    this.csvInput = out.header + '\n' + out.rows.join('\n');
    this.csvReport = null;
    this.show(`${out.rows.length} ligne(s) rechargée(s) — corrigez et ré-importez`, 'ok');
  }

  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : ''; }
  private show(m: string, k: 'ok'|'err') { this.toast = m; this.toastKind = k; setTimeout(() => this.toast = '', 4000); }

  // ─── Fulfillment actions ────────────────────────────────────────
  // Shared label map covering both fulfillment statuses (PENDING/PREPARING/...)
  // and parent-order statuses (CONFIRMED/PROCESSING/PARTIALLY_SHIPPED/...).
  // Falls back to the raw key when an unknown value is encountered (defensive).
  statusLabel(s: string): string {
    const map: Record<string, string> = {
      // Fulfillment statuses
      PENDING: 'En attente',
      PREPARING: 'En préparation',
      SHIPPED: 'Expédié',
      DELIVERED: 'Livré',
      CANCELLED: 'Annulé',
      // Parent-order statuses
      PAYMENT_PENDING: 'Paiement en attente',
      CONFIRMED: 'Confirmée',
      PROCESSING: 'En préparation',
      READY: 'Prête',
      PARTIALLY_SHIPPED: 'Partiellement expédiée',
      IN_TRANSIT: 'En transit',
      OUT_FOR_DELIVERY: 'En cours de livraison',
      PARTIALLY_DELIVERED: 'Partiellement livrée',
      COMPLETED: 'Terminée',
      RETURNED: 'Retournée',
      REFUNDED: 'Remboursée',
      FAILED: 'Échouée',
    };
    return map[s] || s;
  }

  prepareItem(it: any) {
    this.http.post(`${environementDev.api}/api/storefront/seller/catalog/orders/items/${it.itemId}/preparing`, {}, { headers: this.headers() })
      .subscribe({
        next: () => { this.show('Article en préparation', 'ok'); this.loadOrders(); },
        error: e => this.show(e?.error?.message || 'Erreur', 'err')
      });
  }

  openShip(it: any) {
    this.shipping = it;
    this.shipForm = { carrier: null, trackingNumber: '', trackingUrl: '', notes: '' };
    this.shipError = '';
  }

  closeShip() { this.shipping = null; this.shipError = ''; }

  confirmShip() {
    if (!this.shipping) return;
    if (!this.shipForm.carrier && !this.shipForm.trackingNumber) {
      this.shipError = 'Indiquez au moins le transporteur ou le numéro de suivi';
      return;
    }
    this.shipSaving = true;
    this.shipError = '';
    this.http.post<any>(`${environementDev.api}/api/storefront/seller/catalog/orders/items/${this.shipping.itemId}/ship`,
      this.shipForm, { headers: this.headers() }
    ).subscribe({
      next: () => { this.shipSaving = false; this.show('Article marqué expédié — le client est notifié', 'ok'); this.closeShip(); this.loadOrders(); },
      error: e => { this.shipSaving = false; this.shipError = e?.error?.message || 'Erreur'; }
    });
  }

  markDelivered(it: any) {
    if (!confirm('Confirmer la livraison de cet article ?')) return;
    this.http.post(`${environementDev.api}/api/storefront/seller/catalog/orders/items/${it.itemId}/delivered`, {}, { headers: this.headers() })
      .subscribe({
        next: () => { this.show('Marqué livré', 'ok'); this.loadOrders(); },
        error: e => this.show(e?.error?.message || 'Erreur', 'err')
      });
  }

  cancelItem(it: any) {
    const reason = prompt('Raison de l\'annulation (visible par le client) :') || '';
    if (!reason && !confirm('Annuler sans raison ?')) return;
    this.http.post(`${environementDev.api}/api/storefront/seller/catalog/orders/items/${it.itemId}/cancel`, { reason }, { headers: this.headers() })
      .subscribe({
        next: () => { this.show('Article annulé', 'ok'); this.loadOrders(); },
        error: e => this.show(e?.error?.message || 'Erreur', 'err')
      });
  }
}
