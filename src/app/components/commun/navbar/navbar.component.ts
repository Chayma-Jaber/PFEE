import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuComponent } from "../menu/menu.component";
import { SearchModalComponent } from "../search-modal/search-modal.component";
import { CategorieService } from '../../../services/categorie.service';
import { AuthService } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { LogoComponent } from "../logo/logo.component";
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule, MenuComponent, SearchModalComponent, ToastModule, LogoComponent],
  templateUrl: './navbar.component.html',
  providers:[MessageService],
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  menuVisible: boolean = false;
  searchModalVisible: boolean = false; // Control search modal visibility
  homePageData: any;
  cartItemCount: number = 0;

  constructor(
    private categorieService: CategorieService,
    private authService: AuthService,
    private cartService: CartService,
    private router: Router,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.categorieService.getHomePageData().subscribe(
      (data) => {
        this.homePageData = data;
      }
    );

    // S'abonner aux changements du panier
    this.cartService.cartItems$.subscribe(items => {
      this.cartItemCount = items.reduce((total, item) => total + item.quantity, 0);
    });
  }

  // Method to check if user is logged in
  isLoggedIn(): boolean {
    return !!localStorage.getItem('jwt');
  }

  // Ajoutez ces propriétés et méthodes à votre classe de composant
  mobileSearchVisible = false;

  toggleMobileSearch() {
    this.mobileSearchVisible = !this.mobileSearchVisible;
  }

  // Method to open search modal
  openSearchMenu() {
    this.searchModalVisible = true;
  }

  // Method to toggle menu (for hamburger button)
  toggleMenu() {
    if (this.menuVisible) {
      this.closeMenu();
    } else {
      this.menuVisible = true;
    }
  }

  // Method to close menu
  closeMenu() {
    this.menuVisible = false;
  }

  // Method to close search modal
  closeSearchModal() {
    this.searchModalVisible = false;
  }

  // si je click sur le  gift card verifier si je suis connecter ou non
  goToGiftCard() {

      localStorage.setItem('showGiftCardFaq', 'true');
      this.router.navigate(['/gift-card']);
   
  }

  // Method to handle logout
  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    this.cartService.clearCart();
    this.messageService.add({
      severity: 'success',
      summary: 'Déconnexion',
      detail: 'Vous avez été déconnecté avec succès',
      life: 3000
    });
    this.router.navigate(['/']);
  }
}