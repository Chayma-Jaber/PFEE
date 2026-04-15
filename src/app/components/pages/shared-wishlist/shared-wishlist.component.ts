import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { WishlistSharingService, PublicSharedWishlist, SharedWishlistProduct } from '../../../services/wishlist-sharing.service';
import { ProductService } from '../../../services/product.service';
import { TitleService } from '../../../services/title.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-shared-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './shared-wishlist.component.html',
  styleUrls: ['./shared-wishlist.component.scss']
})
export class SharedWishlistComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  wishlist: PublicSharedWishlist | null = null;
  isLoading = true;
  error: string | null = null;
  token: string = '';

  constructor(
    private route: ActivatedRoute,
    private wishlistSharingService: WishlistSharingService,
    private productService: ProductService,
    private titleService: TitleService
  ) {}

  ngOnInit(): void {
    this.titleService.setSpecificTitle('Wishlist Partagee');

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.loadSharedWishlist();
      } else {
        this.error = 'Token de partage manquant';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSharedWishlist(): void {
    this.isLoading = true;
    this.error = null;

    this.wishlistSharingService.getSharedWishlist(this.token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (wishlist) => {
          if (wishlist) {
            this.wishlist = wishlist;
            this.titleService.setSpecificTitle(wishlist.title || 'Wishlist Partagee');
          } else {
            this.error = 'expired';
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading shared wishlist:', err);
          this.error = 'load_error';
          this.isLoading = false;
        }
      });
  }

  getProductSlug(product: SharedWishlistProduct): string {
    // Generate slug from product ID and title
    const slugTitle = product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${product.id}-${slugTitle}`;
  }

  getProductUrl(product: SharedWishlistProduct): string {
    return `/produit/${this.getProductSlug(product)}`;
  }

  formatPrice(price: number): string {
    return `${price.toFixed(3)} TND`;
  }

  calculateDiscount(product: SharedWishlistProduct): number {
    if (product.discount && product.price > product.currentPrice) {
      return Math.round(((product.price - product.currentPrice) / product.price) * 100);
    }
    return 0;
  }

  retryLoad(): void {
    this.loadSharedWishlist();
  }
}
