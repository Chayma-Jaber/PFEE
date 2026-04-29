import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, LikeThisDetected, ProductCard } from '../../../services/chatbot.service';
import { CartService, CartItem } from '../../../services/cart.service';
import { BehaviorAnalyticsService } from '../../../services/behavior-analytics.service';
import { forkJoin, catchError, of, Subscription } from 'rxjs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
  products?: any[];
  complementProducts?: any[];
  imagePreview?: string;
  detected?: LikeThisDetected;
  isLikeThis?: boolean;
}

interface ToastNotification {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, AfterViewChecked, OnDestroy {

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;

  isOpen = false;
  isFullScreen = false;
  userInput = '';
  isLoading = false;
  loadingText = 'Analyse du style en cours...';
  messages: Message[] = [];
  quickReplies: string[] = [];

  pendingImageBase64: string | null = null;
  pendingImagePreview: string | null = null;

  userContext = {
    isLoggedIn: false,
    profile: null as any,
    orders: [] as any[],
    coupons: [] as any[],
    returns: [] as any[],
    motifs: [] as any[],
    wishlist: [] as any[]
  };

  // Toast notification for add to cart feedback
  toast: ToastNotification = { message: '', type: 'success', visible: false };
  private toastTimeout: any;

  private conversationHistory: ChatMessage[] = [];
  private subscriptions: Subscription = new Subscription();

  // Premium greeting based on time of day
  private get timeGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon apr\u00e8s-midi';
    return 'Bonsoir';
  }

  constructor(
    private chatService: ChatService,
    private cartService: CartService,
    private analytics: BehaviorAnalyticsService
  ) { }

  ngOnInit(): void {
    // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ Subs ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬
    this.subscriptions.add(
      this.chatService.chatOpen$.subscribe(open => {
        this.isOpen = open;
        if (open && this.messages.length === 0) {
          this.initChat();
        }
      })
    );

    this.subscriptions.add(
      this.chatService.visualSearchTrigger$.subscribe(() => {
        setTimeout(() => this.triggerImageUpload(), 100);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initChat(): void {
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      this.loadUserData();
    } else {
      this.addAssistantMessage(`${this.timeGreeting} et bienvenue chez **Barsha**. Je suis votre styliste personnel, pr\u00eat \u00e0 vous guider vers le look parfait. Que recherchez-vous aujourd'hui ?`);
    }
    this.quickReplies = this.getPremiumQuickReplies();
  }

  private getPremiumQuickReplies(): string[] {
    const hour = new Date().getHours();
    const season = this.getCurrentSeason();

    // Contextual premium suggestions
    const baseReplies = [
      'Tendances du moment \u2728',
      'Trouver mon style id\u00e9al \ud83d\udc8e'
    ];

    if (this.userContext.isLoggedIn && this.userContext.orders.length > 0) {
      baseReplies.push('Suivi de ma commande \ud83d\udce6');
    }

    if (this.userContext.coupons && this.userContext.coupons.length > 0) {
      baseReplies.push(`Mes ${this.userContext.coupons.length} offres exclusives \ud83c\udf81`);
    } else {
      baseReplies.push('Offres exclusives \ud83c\udf81');
    }

    // Season-specific suggestion
    if (season === 'summer') {
      baseReplies.push('Collection \u00e9t\u00e9 \u2600\ufe0f');
    } else if (season === 'winter') {
      baseReplies.push('Looks hiver cozy \u2744\ufe0f');
    }

    return baseReplies.slice(0, 4);
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 5 && month <= 8) return 'summer';
    if (month >= 11 || month <= 2) return 'winter';
    return 'spring';
  }

  private getProfileDisplayName(profile: any): string | null {
    if (!profile) return null;

    const firstName = profile.firstName || profile.first_name || profile.firstname;
    const lastName = profile.lastName || profile.last_name || profile.lastname;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    if (fullName) return fullName;
    if (profile.name) return String(profile.name).trim();
    if (profile.username) return String(profile.username).trim();
    return null;
  }

  private loadUserData(): void {
    this.isLoading = true;
    this.loadingText = 'Pr\u00e9paration de votre exp\u00e9rience personnalis\u00e9e...';
    forkJoin({
      profile: this.chatService.getUserProfile().pipe(catchError(() => of(null))),
      orders: this.chatService.getOrders().pipe(catchError(() => of([]))),
      coupons: this.chatService.getValidCoupons().pipe(catchError(() => of([]))),
      motifs: this.chatService.getReturnMotifs().pipe(catchError(() => of({ hits: [] }))),
      wishlist: this.chatService.getWishListItems().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.userContext.isLoggedIn = !!res.profile;
        this.userContext.profile = res.profile;
        this.userContext.orders = res.orders || [];
        this.userContext.coupons = res.coupons || [];
        this.userContext.motifs = res.motifs?.hits || [];
        this.userContext.wishlist = res.wishlist || [];

        const name = this.getProfileDisplayName(res.profile) || 'cher client';
        let greeting = `${this.timeGreeting} **${name}** ! Ravie de vous retrouver.`;

        // Personalized context-aware greeting
        const pendingOrders = this.userContext.orders.filter((o: any) =>
          ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(o.status)
        );
        const couponsCount = this.userContext.coupons.length;
        const wishlistCount = this.userContext.wishlist.length;

        if (pendingOrders.length > 0) {
          greeting += ` Vous avez **${pendingOrders.length} commande${pendingOrders.length > 1 ? 's' : ''}** en cours.`;
        }

        if (couponsCount > 0) {
          greeting += ` \ud83c\udf81 **${couponsCount} offre${couponsCount > 1 ? 's' : ''} exclusive${couponsCount > 1 ? 's' : ''}** vous attend${couponsCount > 1 ? 'ent' : ''} !`;
        }

        if (wishlistCount > 0 && couponsCount === 0) {
          greeting += ` Je vois que vous avez **${wishlistCount} article${wishlistCount > 1 ? 's' : ''}** dans vos favoris.`;
        }

        greeting += ' Comment puis-je vous accompagner ?';

        this.addAssistantMessage(greeting);
        this.quickReplies = this.getPremiumQuickReplies();
        this.isLoading = false;
      },
      error: () => {
        this.addAssistantMessage(`${this.timeGreeting} ! Je suis votre conseill\u00e8re style Barsha. Comment puis-je vous aider \u00e0 trouver le look parfait ?`);
        this.quickReplies = this.getPremiumQuickReplies();
        this.isLoading = false;
      }
    });
  }

  private addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: new Date() });
  }

  ngAfterViewChecked(): void {
    // Le scrollToBottom automatique ici bloquait l'utilisateur. Il est gÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ailleurs.
  }

  toggleChat(): void {
    const wasOpen = this.isOpen;
    this.chatService.toggleChat(!this.isOpen);
    if (!this.isOpen) this.isFullScreen = false; // Reset if closed
    // Track assistant open
    if (!wasOpen) {
      this.analytics.trackAssistantOpen();
    }
  }

  toggleFullScreen(): void {
    this.isFullScreen = !this.isFullScreen;
  }

  async sendMessage(text?: string): Promise<void> {
    const content = (text || this.userInput).trim();
    if (!content || this.isLoading) return;

    this.userInput = '';
    this.quickReplies = [];
    this.isLoading = true;
    this.loadingText = 'Barsha AI réfléchit...';

    this.messages.push({ role: 'user', content, timestamp: new Date() });
    this.conversationHistory.push({ role: 'user', content });

    // Track assistant message
    this.analytics.trackAssistantMessage(content.substring(0, 50));

    const loadingMsg: Message = { role: 'assistant', content: '', timestamp: new Date(), loading: true };
    this.messages.push(loadingMsg);

    try {
      const response = await this.chatService.sendMessage(this.conversationHistory, this.userContext);
      const idx = this.messages.indexOf(loadingMsg);
      const displayText = this.buildDisplayedAssistantText(response.text, response.products || []);
      
      // On prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©pare le message avec un contenu vide
      this.messages[idx] = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        products: response.products
      };
      
      this.conversationHistory.push({ role: 'assistant', content: response.text });
      if (this.conversationHistory.length > 20) this.conversationHistory = this.conversationHistory.slice(-20);
      
      // Effet d'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©criture (streaming) : 3 caractÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨res par ms / tick
      const fullText = displayText;
      let currentLength = 0;
      const charsPerTick = 3;
      
      const typeInterval = setInterval(() => {
        currentLength += charsPerTick;
        if (currentLength >= fullText.length) {
          this.messages[idx].content = fullText;
          this.quickReplies = this.chatService.getQuickReplies(fullText);
          clearInterval(typeInterval);
          this.scrollToBottom();
        } else {
          this.messages[idx].content = fullText.substring(0, currentLength);
          this.scrollToBottom();
        }
      }, 5); // 5ms pour une ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©criture trÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨s rapide et fluide

    } catch {
      const idx = this.messages.indexOf(loadingMsg);
      this.messages[idx].content = 'Je rencontre un petit souci technique. Puis-je r\u00e9essayer ? En attendant, n\'h\u00e9sitez pas \u00e0 explorer nos **nouveaut\u00e9s** ou \u00e0 me poser une autre question.';
      this.messages[idx].loading = false;
      this.quickReplies = ['R\u00e9essayer \ud83d\udd04', 'Voir les nouveaut\u00e9s \u2728', 'Aide \ud83d\udc4b'];
    } finally {
      this.isLoading = false;
    }
  }

  triggerImageUpload(): void {
    this.fileInput.nativeElement.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    input.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      this.pendingImageBase64 = base64;
      this.pendingImagePreview = base64;
      // Auto-send image for visual search if triggered from landing
      this.sendImageMessage();
    };
    reader.readAsDataURL(file);
  }

  cancelPendingImage(): void {
    this.pendingImageBase64 = null;
    this.pendingImagePreview = null;
  }

  async sendImageMessage(): Promise<void> {
    if (!this.pendingImageBase64 || this.isLoading) return;

    const base64 = this.pendingImageBase64;
    const preview = this.pendingImagePreview!;
    this.pendingImageBase64 = null;
    this.pendingImagePreview = null;
    this.quickReplies = [];
    this.isLoading = true;
    this.loadingText = 'Analyse du style en cours...';

    this.messages.push({
      role: 'user',
      content: 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ Recherche de similaritÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢articles par image',
      imagePreview: preview,
      timestamp: new Date()
    });

    const loadingMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
      isLikeThis: true
    };
    this.messages.push(loadingMsg);

    try {
      const result = await this.chatService.analyzeImage(base64);
      const idx = this.messages.indexOf(loadingMsg);

      const d = result.detected;

      // Track visual search upload
      this.analytics.trackVisualSearchUpload(
        result.similaires?.length || 0,
        d.confidence
      );
      const summaryText = `Voici un look **${d.title_guess || 'tendance'}** basÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© sur votre image. ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½`;

      this.messages[idx] = {
        role: 'assistant',
        content: summaryText,
        timestamp: new Date(),
        isLikeThis: true,
        detected: d,
        products: result.similaires,
        complementProducts: result.complements
      };

      this.quickReplies = ['Voir plus chic ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨', 'Moins cher ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸', 'Ajouter des chaussures ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸'];

    } catch {
      const idx = this.messages.indexOf(loadingMsg);
      this.messages[idx].content = 'Je n\'ai pas pu analyser cette image. Pour de meilleurs r\u00e9sultats, essayez avec une photo bien \u00e9clair\u00e9e montrant clairement le v\u00eatement ou l\'accessoire.';
      this.messages[idx].loading = false;
      this.quickReplies = ['R\u00e9essayer avec une autre photo \ud83d\udcf7', 'D\u00e9crire ce que je cherche \u270d\ufe0f'];
    } finally {
      this.isLoading = false;
    }
  }

  // ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ ADD TO CART FROM CHAT ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬
  addToCartFromChat(product: any, event: Event): void {
    event.stopPropagation(); // Prevent card click navigation

    // Extract product ID from URL or reference
    let productId = '';
    if (product.url) {
      const match = product.url.match(/produit\/(\d+)/);
      if (match) productId = match[1];
    }

    if (!productId && product.reference) {
      const idMatch = product.reference.match(/ID:(\d+)/);
      if (idMatch) productId = idMatch[1];
    }

    if (!productId) {
      this.showToast('Impossible d\'ajouter ce produit. Veuillez le consulter directement.', 'error');
      return;
    }

    // Create a simplified cart item for quick add
    // Note: This adds with default options - user can adjust in cart
    const cartItem: CartItem = {
      product: {
        id: parseInt(productId),
        title: product.nom || 'Produit Barsha',
        currentPrice: this.extractPrice(product.prix),
        sku: product.reference || '',
        // Minimal product data - the cart will handle the rest
      } as any,
      image: product.image || 'assets/logo.jpg',
      quantity: 1,
      selectedColor: product.color || '',
      selectedSize: product.size || '',
      ean13: ''
    };

    this.cartService.addToCartDirectly(cartItem);
    this.showToast(`\u2713 ${product.nom || 'Article'} ajout\u00e9 au panier`, 'success');

    // Track add to cart from assistant
    this.analytics.trackAssistantAddToCart(parseInt(productId));

    // Update quick replies to suggest next action
    this.quickReplies = [
      'Voir mon panier \ud83d\udecd\ufe0f',
      'Continuer mes achats \u2728',
      'Articles similaires \ud83d\udc57'
    ];
  }

  private extractPrice(priceStr: string): number {
    if (!priceStr) return 0;
    const match = priceStr.match(/([\d.,]+)/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return 0;
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toast = { message, type, visible: true };

    this.toastTimeout = setTimeout(() => {
      this.toast.visible = false;
    }, 3000);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.pendingImageBase64) {
        this.sendImageMessage();
      } else {
        this.sendMessage();
      }
    }
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch { }
  }

  private buildDisplayedAssistantText(rawText: string, products: ProductCard[]): string {
    if (!products || products.length === 0) {
      return rawText;
    }

    const uniqueNames = products
      .map((product) => (product.nom || '').trim())
      .filter(Boolean)
      .filter((name, index, arr) => arr.indexOf(name) === index);

    const previewNames = uniqueNames.slice(0, 3);

    if (previewNames.length === 0) {
      return 'Voici une selection d\'articles qui correspond a votre demande. Dites-moi si vous voulez que j\'affine par couleur, style, occasion ou budget.';
    }

    if (previewNames.length === 1) {
      return `J'ai trouve un article qui correspond a votre demande : **${previewNames[0]}**. Dites-moi si vous voulez d'autres options dans le meme style, une autre couleur ou un budget different.`;
    }

    const namesText =
      previewNames.length === 2
        ? `${previewNames[0]} et ${previewNames[1]}`
        : `${previewNames[0]}, ${previewNames[1]} et ${previewNames[2]}`;

    return `Voici une selection d'articles qui correspond a votre demande : **${namesText}**. Dites-moi si vous voulez que je resserre la selection par couleur, occasion, style ou budget.`;
  }

  formatMessage(text: string): string {
    if (!text) return '';
    // Nettoyage Markdown simple + format Premium
    let cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" class="chat-link">$1</a>')
      .replace(/\n\n+/g, '<br><br>')
      .replace(/\n/g, '<br>');

    // Suppression rigoureuse des lignes techniques (Produits, images, etc.)
    const lines = cleanText.split('<br>');
    const filteredLines = lines.filter(l => {
      const low = l.toLowerCase().trim();
      if (!low) return true;
      // Filtre les lignes avec [ID:xxx] ou contenant | avec des termes techniques
      if (low.includes('[id:') || low.includes('imgprincipale:') || low.includes('couleurs+images:')) return false;
      if (low.includes('|') && (low.includes('tnd') || low.includes('dt') || low.includes('famille:'))) return false;
      if (low.startsWith('-') && (low.includes('http') || low.includes('.jpg') || low.includes('.png'))) return false;
      return true;
    });

    return filteredLines.join('<br>').trim();
  }

  get window(): Window {
    return window;
  }
}
