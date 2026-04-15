import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupportService, SupportTicket, TicketStats, TicketCategory, TicketPriority, TicketStatus } from '../../../../services/support.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class AdminSupportComponent implements OnInit, OnDestroy {
  // View state
  currentView: 'inbox' | 'detail' = 'inbox';

  // Loading states
  isLoading = false;
  isSubmitting = false;

  // Ticket list
  tickets: SupportTicket[] = [];
  pagination = { page: 1, total: 0, pages: 0 };

  // Filters
  statusFilter = '';
  priorityFilter = '';
  categoryFilter = '';
  searchQuery = '';
  showUnassignedOnly = false;

  // Stats
  stats: TicketStats | null = null;

  // Selected ticket
  selectedTicket: SupportTicket | null = null;
  newMessage = '';
  isInternalNote = false;

  // Agents list
  agents: any[] = [];

  // Resolution
  showResolveModal = false;
  resolutionNotes = '';

  // Messages
  successMessage = '';
  errorMessage = '';

  // Auto-refresh
  private refreshSubscription?: Subscription;

  // Dropdown options
  categories: { value: TicketCategory; label: string }[] = [
    { value: 'order', label: 'Commande' },
    { value: 'product', label: 'Produit' },
    { value: 'delivery', label: 'Livraison' },
    { value: 'return', label: 'Retour' },
    { value: 'payment', label: 'Paiement' },
    { value: 'account', label: 'Compte' },
    { value: 'technical', label: 'Technique' },
    { value: 'complaint', label: 'R\u00e9clamation' },
    { value: 'suggestion', label: 'Suggestion' },
    { value: 'other', label: 'Autre' }
  ];

  priorities: { value: TicketPriority; label: string }[] = [
    { value: 'low', label: 'Faible' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'high', label: 'Haute' },
    { value: 'urgent', label: 'Urgente' }
  ];

  statuses: { value: string; label: string }[] = [
    { value: '', label: 'Tous' },
    { value: 'open', label: 'Ouverts' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'awaiting_customer', label: 'Attente client' },
    { value: 'resolved', label: 'R\u00e9solus' },
    { value: 'closed', label: 'Ferm\u00e9s' }
  ];

  constructor(private supportService: SupportService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadTickets();
    this.loadAgents();

    // Auto-refresh every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      if (this.currentView === 'inbox') {
        this.loadTickets(true);
        this.loadStats();
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  // Load statistics
  loadStats(): void {
    this.supportService.adminGetStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (err) => {
        console.error('Error loading stats:', err);
      }
    });
  }

  // Load tickets
  loadTickets(silent = false): void {
    if (!silent) this.isLoading = true;

    this.supportService.adminGetTickets({
      page: this.pagination.page,
      status: this.statusFilter || undefined,
      priority: this.priorityFilter || undefined,
      category: this.categoryFilter || undefined,
      unassigned: this.showUnassignedOnly,
      search: this.searchQuery || undefined
    }).subscribe({
      next: (response) => {
        this.tickets = response.tickets || [];
        this.pagination = response.pagination || { page: 1, total: 0, pages: 0 };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading tickets:', err);
        this.errorMessage = 'Erreur lors du chargement des tickets';
        this.isLoading = false;
      }
    });
  }

  // Load agents
  loadAgents(): void {
    this.supportService.adminGetAgents().subscribe({
      next: (response) => {
        this.agents = response.agents || [];
      },
      error: (err) => {
        console.error('Error loading agents:', err);
      }
    });
  }

  // Apply filters
  applyFilters(): void {
    this.pagination.page = 1;
    this.loadTickets();
  }

  // Reset filters
  resetFilters(): void {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.categoryFilter = '';
    this.searchQuery = '';
    this.showUnassignedOnly = false;
    this.pagination.page = 1;
    this.loadTickets();
  }

  // View ticket detail
  viewTicket(ticket: SupportTicket): void {
    this.isLoading = true;
    this.supportService.adminGetTicket(ticket.id).subscribe({
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

  // Back to inbox
  backToInbox(): void {
    this.currentView = 'inbox';
    this.selectedTicket = null;
    this.newMessage = '';
    this.isInternalNote = false;
    this.loadTickets();
    this.loadStats();
  }

  // Assign ticket to self
  assignToSelf(): void {
    if (!this.selectedTicket) return;

    this.isSubmitting = true;
    this.supportService.adminAssignTicket(this.selectedTicket.id).subscribe({
      next: () => {
        // Refresh ticket
        this.viewTicket(this.selectedTicket!);
        this.successMessage = 'Ticket assign\u00e9 \u00e0 vous';
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error assigning ticket:', err);
        this.errorMessage = 'Erreur lors de l\'assignation';
        this.isSubmitting = false;
      }
    });
  }

  // Assign to another agent
  assignToAgent(agentId: number): void {
    if (!this.selectedTicket) return;

    this.isSubmitting = true;
    this.supportService.adminAssignTicket(this.selectedTicket.id, agentId).subscribe({
      next: () => {
        this.viewTicket(this.selectedTicket!);
        this.successMessage = 'Ticket r\u00e9assign\u00e9';
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error reassigning ticket:', err);
        this.errorMessage = 'Erreur lors de la r\u00e9assignation';
        this.isSubmitting = false;
      }
    });
  }

  // Send message
  sendMessage(): void {
    if (!this.selectedTicket || !this.newMessage.trim()) return;

    this.isSubmitting = true;
    this.supportService.adminAddMessage(
      this.selectedTicket.id,
      this.newMessage,
      this.isInternalNote
    ).subscribe({
      next: (response) => {
        if (this.selectedTicket && this.selectedTicket.messages) {
          this.selectedTicket.messages.push(response.message);
        }
        this.newMessage = '';
        this.isInternalNote = false;
        this.isSubmitting = false;
        this.successMessage = this.isInternalNote ? 'Note interne ajout\u00e9e' : 'R\u00e9ponse envoy\u00e9e';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.errorMessage = 'Erreur lors de l\'envoi';
        this.isSubmitting = false;
      }
    });
  }

  // Update ticket priority
  updatePriority(priority: TicketPriority): void {
    if (!this.selectedTicket) return;

    this.supportService.adminUpdateTicket(this.selectedTicket.id, { priority }).subscribe({
      next: () => {
        if (this.selectedTicket) {
          this.selectedTicket.priority = priority;
        }
        this.successMessage = 'Priorit\u00e9 mise \u00e0 jour';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error updating priority:', err);
        this.errorMessage = 'Erreur lors de la mise \u00e0 jour';
      }
    });
  }

  // Update ticket category
  updateCategory(category: TicketCategory): void {
    if (!this.selectedTicket) return;

    this.supportService.adminUpdateTicket(this.selectedTicket.id, { category }).subscribe({
      next: () => {
        if (this.selectedTicket) {
          this.selectedTicket.category = category;
        }
        this.successMessage = 'Cat\u00e9gorie mise \u00e0 jour';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error updating category:', err);
        this.errorMessage = 'Erreur lors de la mise \u00e0 jour';
      }
    });
  }

  // Open resolve modal
  openResolveModal(): void {
    this.showResolveModal = true;
    this.resolutionNotes = '';
  }

  // Resolve ticket
  resolveTicket(): void {
    if (!this.selectedTicket || !this.resolutionNotes.trim()) return;

    this.isSubmitting = true;
    this.supportService.adminResolveTicket(this.selectedTicket.id, this.resolutionNotes).subscribe({
      next: () => {
        this.showResolveModal = false;
        this.viewTicket(this.selectedTicket!);
        this.successMessage = 'Ticket r\u00e9solu';
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error resolving ticket:', err);
        this.errorMessage = 'Erreur lors de la r\u00e9solution';
        this.isSubmitting = false;
      }
    });
  }

  // Close ticket
  closeTicket(): void {
    if (!this.selectedTicket) return;

    this.isSubmitting = true;
    this.supportService.adminCloseTicket(this.selectedTicket.id).subscribe({
      next: () => {
        this.viewTicket(this.selectedTicket!);
        this.successMessage = 'Ticket ferm\u00e9';
        this.isSubmitting = false;
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        console.error('Error closing ticket:', err);
        this.errorMessage = 'Erreur lors de la fermeture';
        this.isSubmitting = false;
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

  getTimeAgo(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '\u00c0 l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return this.formatDate(dateString);
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.pagination.pages) return;
    this.pagination.page = page;
    this.loadTickets();
  }
}
