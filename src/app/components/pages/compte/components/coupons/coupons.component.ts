import { CommonModule } from '@angular/common';
import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ProfileService } from '../../../sign/profile';
import { GiftCardService } from '../../../gift-card/gift-card.service';
import JsBarcode from 'jsbarcode';

interface Coupon {
  id: number;
  code: string;
  date_from: string;
  date_to: string;
  description: string;
  priority: number;
  min_total: number;
  discount_amount: number;
  discount_percent: number;
  category: string;
  appliq_method: string;
  type: string;
  details: string;
  bar_code: string | null;
}

interface CouponsByCategory {
  fidTransCoupons: Coupon[];
  marketingCoupons: Coupon[];
  otherCoupons: Coupon[];
}

@Component({
  selector: 'app-coupons',
  imports: [CommonModule],
  templateUrl: './coupons.component.html',
  styleUrl: './coupons.component.scss'
})
export class CouponsComponent implements AfterViewChecked {
  coupons: Coupon[] = [];
  couponsAll: CouponsByCategory = {
    fidTransCoupons: [],
    marketingCoupons: [],
    otherCoupons: []
  };
  isLoading: boolean = false;
  qrCodesLoading: { [key: string]: boolean } = {};
  barcodesGenerated: { [key: string]: boolean } = {};

  constructor(
    private giftCardService: GiftCardService
  ) { }

  ngOnInit(): void {
    this.getCoupons();
  }

  getCouponsPublic() {
    this.isLoading = true;
    this.giftCardService.getCouponsUserPublic().subscribe({
      next: (response) => {
        this.coupons = response['data'] as Coupon[];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des coupons', error);
        this.isLoading = false;
      }
    });
  }


  getCoupons() {
    this.isLoading = true;
    this.giftCardService.getCoupons().subscribe({
      next: (response) => {
        this.coupons = response['data'] as Coupon[];
        // Classement des coupons par catégorie pour l'affichage
        this.couponsAll = {
          fidTransCoupons: this.coupons.filter(c => c.category === 'FidTrans'),
          marketingCoupons: this.coupons.filter(c => c.category === 'Marketing'),
          otherCoupons: this.coupons.filter(c => c.category !== 'FidTrans' && c.category !== 'Marketing')
        };
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des coupons', error);
        this.isLoading = false;
      }
    });
  }

  onQrCodeLoaded(code: string) {
    this.qrCodesLoading[code] = false;
  }

  ngAfterViewChecked(): void {
    setTimeout(() => {
      this.generateBarcodes();
    }, 50);
  }

  generateBarcodes(): void {
    const allCoupons = [
      ...this.couponsAll.fidTransCoupons,
      ...this.couponsAll.marketingCoupons,
      ...this.couponsAll.otherCoupons
    ];

    allCoupons.forEach(coupon => {
      if (coupon.bar_code && !this.barcodesGenerated[coupon.code]) {
        try {
          // Desktop barcode
          const element = document.getElementById(`barcode-${coupon.code}`);
          if (element && element.innerHTML.trim() === '') {
            JsBarcode(`#barcode-${coupon.code}`, coupon.bar_code, {
              format: 'CODE128',
              width: 2,
              height: 50,
              displayValue: false,
              margin: 5
            });
          }
          // Mobile barcode
          const mobElement = document.getElementById(`barcode-mob-${coupon.code}`);
          if (mobElement && mobElement.innerHTML.trim() === '') {
            JsBarcode(`#barcode-mob-${coupon.code}`, coupon.bar_code, {
              format: 'CODE128',
              width: 2,
              height: 45,
              displayValue: false,
              margin: 3
            });
          }
          // Mark as generated only when at least the desktop one is done
          if (element && element.innerHTML.trim() !== '') {
            this.barcodesGenerated[coupon.code] = true;
          }
        } catch (error) {
          console.error(`Erreur lors de la génération du code-barres pour ${coupon.code}:`, error);
        }
      }
    });
  }
}