import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environementDev } from '../../environements/environementDev';

export interface SupportTicket {
  id: number;
  reference: string;
  userId?: number;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  orderId?: number;
  orderReference?: string;
  productId?: number;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  assignedTo?: number;
  resolutionNotes?: string;
  resolvedAt?: string;
  satisfactionRating?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  lastCustomerMessageAt?: string;
  lastAgentMessageAt?: string;
  messageCount: number;
  isOpen: boolean;
  messages?: TicketMessage[];
  customer?: {
    id: number;
    name: string;
    email: string;
  };
  agent?: {
    id: number;
    name: string;
  };
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  senderId?: number;
  senderName: string;
  message: string;
  isFromCustomer: boolean;
  isInternal: boolean;
  isSystem: boolean;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  messageId?: number;
  filename: string;
  originalFilename: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
}

export type TicketCategory = 'order' | 'product' | 'delivery' | 'return' | 'payment' | 'account' | 'technical' | 'complaint' | 'suggestion' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'awaiting_customer' | 'resolved' | 'closed' | 'reopened';

export interface CreateTicketRequest {
  subject: string;
  message: string;
  category: TicketCategory;
  priority?: TicketPriority;
  orderId?: number;
  productId?: number;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
}

export interface TicketStats {
  open: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgent: number;
  overdue: number;
  todayCreated: number;
  avgSatisfactionRating?: number;
  byCategory: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class SupportService {
  private apiUrl = environementDev.api;

  // Track unread tickets for notification badge
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_jwt') || localStorage.getItem('jwt') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ==================== CUSTOMER ENDPOINTS ====================

  /**
   * Create a new support ticket
   */
  createTicket(request: CreateTicketRequest): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/support/tickets`,
      {
        subject: request.subject,
        message: request.message,
        category: request.category,
        priority: request.priority || 'medium',
        order_id: request.orderId,
        product_id: request.productId,
        contact_email: request.contactEmail,
        contact_phone: request.contactPhone,
        contact_name: request.contactName
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get current user's tickets
   */
  getMyTickets(page: number = 1, status?: string): Observable<any> {
    let params = new HttpParams().set('page', page.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get(`${this.apiUrl}/api/support/tickets`, {
      headers: this.getHeaders(),
      params
    });
  }

  /**
   * Get a specific ticket by ID
   */
  getTicket(ticketId: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(
      `${this.apiUrl}/api/support/tickets/${ticketId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get a ticket by its reference number (for guest tracking)
   */
  getTicketByReference(reference: string): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(
      `${this.apiUrl}/api/support/tickets/reference/${reference}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Add a message to a ticket
   */
  addMessage(ticketId: number, message: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/support/tickets/${ticketId}/messages`,
      { message },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Reopen a resolved ticket
   */
  reopenTicket(ticketId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/support/tickets/${ticketId}/reopen`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Rate ticket resolution
   */
  rateTicket(ticketId: number, rating: number, comment?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/support/tickets/${ticketId}/rate`,
      { rating, comment },
      { headers: this.getHeaders() }
    );
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all tickets (admin inbox)
   */
  adminGetTickets(options: {
    page?: number;
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: number;
    unassigned?: boolean;
    search?: string;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', options.page.toString());
    if (options.status) params = params.set('status', options.status);
    if (options.priority) params = params.set('priority', options.priority);
    if (options.category) params = params.set('category', options.category);
    if (options.assignedTo) params = params.set('assigned_to', options.assignedTo.toString());
    if (options.unassigned) params = params.set('unassigned', 'true');
    if (options.search) params = params.set('search', options.search);

    return this.http.get(`${this.apiUrl}/api/admin/support/tickets`, {
      headers: this.getHeaders(),
      params
    });
  }

  /**
   * Get ticket statistics for admin dashboard
   */
  adminGetStats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(
      `${this.apiUrl}/api/admin/support/tickets/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      tap(stats => {
        // Update unread count (open + unassigned)
        this.unreadCountSubject.next(stats.open + stats.unassigned);
      })
    );
  }

  /**
   * Get a specific ticket (admin view with internal messages)
   */
  adminGetTicket(ticketId: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(
      `${this.apiUrl}/api/admin/support/tickets/${ticketId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Update ticket details (admin)
   */
  adminUpdateTicket(ticketId: number, updates: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedTo?: number | null;
    category?: TicketCategory;
    internalNotes?: string;
    tags?: string;
  }): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/admin/support/tickets/${ticketId}`,
      {
        status: updates.status,
        priority: updates.priority,
        assigned_to: updates.assignedTo,
        category: updates.category,
        internal_notes: updates.internalNotes,
        tags: updates.tags
      },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Assign ticket to an agent
   */
  adminAssignTicket(ticketId: number, agentId?: number): Observable<any> {
    let url = `${this.apiUrl}/api/admin/support/tickets/${ticketId}/assign`;
    if (agentId) {
      url += `?agent_id=${agentId}`;
    }
    return this.http.post(url, {}, { headers: this.getHeaders() });
  }

  /**
   * Add a message to a ticket (admin/agent response)
   */
  adminAddMessage(ticketId: number, message: string, isInternal: boolean = false): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/support/tickets/${ticketId}/messages`,
      { message, is_internal: isInternal },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Resolve a ticket
   */
  adminResolveTicket(ticketId: number, resolutionNotes: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/support/tickets/${ticketId}/resolve`,
      { resolution_notes: resolutionNotes },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Close a ticket
   */
  adminCloseTicket(ticketId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/admin/support/tickets/${ticketId}/close`,
      {},
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get list of support agents for assignment
   */
  adminGetAgents(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/api/admin/support/agents`,
      { headers: this.getHeaders() }
    );
  }

  // ==================== HELPERS ====================

  /**
   * Get category display label
   */
  getCategoryLabel(category: TicketCategory): string {
    const labels: Record<TicketCategory, string> = {
      'order': 'Commande',
      'product': 'Produit',
      'delivery': 'Livraison',
      'return': 'Retour',
      'payment': 'Paiement',
      'account': 'Compte',
      'technical': 'Technique',
      'complaint': 'R\u00e9clamation',
      'suggestion': 'Suggestion',
      'other': 'Autre'
    };
    return labels[category] || category;
  }

  /**
   * Get priority display label and color
   */
  getPriorityInfo(priority: TicketPriority): { label: string; color: string; bgColor: string } {
    const info: Record<TicketPriority, { label: string; color: string; bgColor: string }> = {
      'low': { label: 'Faible', color: '#6b7280', bgColor: '#f3f4f6' },
      'medium': { label: 'Moyenne', color: '#3b82f6', bgColor: '#dbeafe' },
      'high': { label: 'Haute', color: '#f59e0b', bgColor: '#fef3c7' },
      'urgent': { label: 'Urgente', color: '#ef4444', bgColor: '#fee2e2' }
    };
    return info[priority] || info['medium'];
  }

  /**
   * Get status display label and color
   */
  getStatusInfo(status: TicketStatus): { label: string; color: string; bgColor: string; icon: string } {
    const info: Record<TicketStatus, { label: string; color: string; bgColor: string; icon: string }> = {
      'open': { label: 'Ouvert', color: '#3b82f6', bgColor: '#dbeafe', icon: 'inbox' },
      'in_progress': { label: 'En cours', color: '#f59e0b', bgColor: '#fef3c7', icon: 'hourglass_empty' },
      'awaiting_customer': { label: 'Attente client', color: '#8b5cf6', bgColor: '#ede9fe', icon: 'schedule' },
      'resolved': { label: 'R\u00e9solu', color: '#10b981', bgColor: '#d1fae5', icon: 'check_circle' },
      'closed': { label: 'Ferm\u00e9', color: '#6b7280', bgColor: '#f3f4f6', icon: 'lock' },
      'reopened': { label: 'R\u00e9ouvert', color: '#f97316', bgColor: '#ffedd5', icon: 'refresh' }
    };
    return info[status] || info['open'];
  }
}
