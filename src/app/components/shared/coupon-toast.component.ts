import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-coupon-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coupon-toast.component.html',
  styleUrls: ['./coupon-toast.component.scss']
})
export class CouponToastComponent {
  @Input() couponCode: string = '';
  @Input() visible: boolean = false;
  @Input() onClose: () => void = () => {};

  close() {
    this.visible = false;
    this.onClose();
  }
}
