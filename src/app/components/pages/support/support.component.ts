import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { SupportService, SupportTicket, TicketCategory, CreateTicketRequest } from '../../../services/support.service';
import { OrderService } from '../../../services/order.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit {
  // View state
  currentView: 'list' | 'detail' | 'create' = 'list';

  // Loading states
  isLoading = false;
  isSubmitting = false;

  // Ticket list
  tickets: SupportTicket[] = [];
  pagination = { page: 1, total: 0, pages: 0 };
  statusFilter: string = '';

  // Selected ticket
  selectedTicket: SupportTicket | null = null;
  newMessage: string = '';

  // Create ticket form
  createForm: CreateTicketRequest = {
    subject: '',
    message: '',
    category: 'other',
    priority: 'medium'
  };

  // Orders for linking tickets
  userOrders: any[] = [];

  // Form validation
  formErrors: { [key: string]: string } = {};

  // Categories for dropdown
  categories: { value: TicketCategory; label: string }[] = [
    { value: 'order', label: 'Probl\u00e8me avec une commande' },
    { value: 'product', label: 'Question sur un produit' },
    { value: 'delivery', label: 'Probl\u00e8me de livraison' },
    { value: 'return', label: 'Retour ou \u00e9change' },
    { value: 'payment', label: 'Probl\u00e8me de paiement' },
    { value: 'account', label: 'Mon compte' },
    { value: 'technical', label: 'Probl\u00e8me technique' },
    { value: 'complaint', label: 'R\u00e9clamation' },
    { value: 'suggestion', label: 'Suggestion' },
    { value: 'other', label: 'Autre' }
  ];

  // Success/error messages
  successMessage: string = '';
  errorMessage: string = '';

  // Rating
  showRatingModal = false;
  ratingValue = 0;
  ratingComment = '';

  constructor(
    private supportService: SupportService,
    private orderService: OrderService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadTickets();
    this.loadUserOrders();

    // Check for query params (e.g., orderId to pre-fill)
    this.route.queryParams.subscribe(params => {
      if (params['orderId']) {
        this.createForm.orderId = parseInt(params['orderId']);
        this.createForm.category = 'order';
        this.currentView = 'create';
      }
      if (params['create'] === 'true') {
        this.currentView = 'create';
      }
    });
  }

  // Load user's tickets
  loadTickets(): void {
    this.isLoading = true;
    this.supportService.getMyTickets(this.pagination.page, this.statusFilter || undefined).subscribe({
      next: (response) => {
        this.tickets = response.tickets || [];
        this.pagination = response.pagination || { page: 1, total: 0, pages: 0 };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading tickets:', err);
        this.errorMessage = 'Erreur lors du chargement de vos demandes';
        this.isLoading = false;
      }
    });
  }

  // Load user's orders for ticket creation
  loadUserOrders(): void {
    this.orderService.getOrders().subscribe({
      next: (response) => {
        this.userOrders = response.data || [];
      },
      error: (err) => {
        console.error('Error loading orders:', err);
      }
    });
  }

  // Filter tickets by status
  filterByStatus(status: string): void {
    this.statusFilter = status;
    this.pagination.page = 1;
    this.loadTickets();
  }

  // View ticket details
  viewTicket(ticket: SupportTicket): void {
    this.isLoading = true;
    this.supportService.getTicket(ticket.id).subscribe({
      next: (fullTicket) => {
        this.selectedTicket = fullTicket;
        this.currentView = 'detail';
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading ticket:', err);
        this.errorMessage = 'Erreur lors du chargement du ticket';
        this.isLoading = false;
      }
    });
  }

  // Go back to list
  backToList(): void {
    this.currentView = 'list';
    this.selectedTicket = null;
    this.newMessage = '';
    this.loadTickets();
  }

  // Open create form
  openCreateForm(): void {
    this.createForm = {
      subject: '',
      message: '',
      category: 'other',
      priority: 'medium'
    };
    this.formErrors = {};
    this.currentView = 'create';
  }

  // Validate create form
  validateForm(): boolean {
    this.formErrors = {};

    if (!this.createForm.subject || this.createForm.subject.trim().length < 5) {
      this.formErrors['subject'] = 'Le sujet doit contenir au moins 5 caract\u00e8res';
    }

    if (!this.createForm.message || this.createForm.message.trim().length < 10) {
      this.formErrors['message'] = 'Le message doit contenir au moins 10 caract\u00e8res';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  // Submit new ticket
  submitTicket(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    this.supportService.createTicket(this.createForm).subscribe({
      next: (response) => {
        this.successMessage = `Votre demande a \u00e9t\u00e9 cr\u00e9\u00e9e avec succ\u00e8s. R\u00e9f\u00e9rence: ${response.ticket.reference}`;
        this.isSubmitting = false;

        // View the newly created ticket
        this.selectedTicket = response.ticket;
        this.currentView = 'detail';

        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (err) => {
        console.error('Error creating ticket:', err);
        this.errorMessage = 'Erreur lors de la cr\u00e9ation de votre demande';
        this.isSubmitting = false;
      }
    });
  }

  // Send a message to the ticket
  sendMessage(): void {
    if (!this.selectedTicket || !this.newMessage.trim()) return;

    this.isSubmitting = true;
    this.supportService.addMessage(this.selectedTicket.id, this.newMessage).subscribe({
      next: (response) => {
        // Add message to local list
        if (this.selectedTicket && this.selectedTicket.messages) {
          this.selectedTicket.messages.push(response.message);
        }
        this.newMessage = '';
        this.isSubmitting = false;
        this.successMessage = 'Message envoy\u00e9';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.errorMessage = 'Erreur lors de l\'envoi du message';
        this.isSubmitting = false;
      }
    });
  }

  // Reopen a resolved ticket
  reopenTicket(): void {
    if (!this.selectedTicket) return;

    this.isSubmitting = true;
    this.supportService.reopenTicket(this.selectedTicket.id).subscribe({
      next: () => {
        if (this.selectedTicket) {
          this.selectedTicket.status = 'reopened';
          this.selectedTicket.isOpen = true;
        }
        this.successMessage = 'Ticket r\u00e9ouvert';
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error reopening ticket:', err);
        this.errorMessage = 'Erreur lors de la r\u00e9ouverture';
        this.isSubmitting = false;
      }
    });
  }

  // Open rating modal
  openRatingModal(): void {
    this.showRatingModal = true;
    this.ratingValue = 0;
    this.ratingComment = '';
  }

  // Submit rating
  submitRating(): void {
    if (!this.selectedTicket || this.ratingValue === 0) return;

    this.supportService.rateTicket(this.selectedTicket.id, this.ratingValue, this.ratingComment).subscribe({
      next: () => {
        if (this.selectedTicket) {
          this.selectedTicket.satisfactionRating = this.ratingValue;
        }
        this.showRatingModal = false;
        this.successMessage = 'Merci pour votre avis !';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error submitting rating:', err);
        this.errorMessage = 'Erreur lors de l\'envoi de votre avis';
      }
    });
  }

  // Helper methods
  getCategoryLabel(category: TicketCategory): string {
    return this.supportService.getCategoryLabel(category);
  }

  getStatusInfo(status: string): { label: string; color: string; bgColor: string; icon: string } {
    return this.supportService.getStatusInfo(status as any);
  }

  getPriorityInfo(priority: string): { label: string; color: string; bgColor: string } {
    return this.supportService.getPriorityInfo(priority as any);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.pagination.pages) return;
    this.pagination.page = page;
    this.loadTickets();
  }
}
