import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, LikeThisDetected } from '../../../services/chatbot.service';
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

  private conversationHistory: ChatMessage[] = [];
  private subscriptions: Subscription = new Subscription();

  constructor(private chatService: ChatService) { }

  ngOnInit(): void {
    // ── Subs ──
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
      this.addAssistantMessage('✨ Bonjour ! Je suis votre assistant mode Barsha. Envie d\'un nouveau look ou besoin d\'aide avec une commande ?');
    }
    this.quickReplies = ['Look pour mariage 💍', 'Sneakers tendances 👟', 'Où est ma commande ? 📦', 'Voir les nouveautés ✨'];
  }

  private loadUserData(): void {
    this.isLoading = true;
    this.loadingText = 'Chargement de votre profil...';
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
        this.userContext.orders = res.orders;
        this.userContext.coupons = res.coupons;
        this.userContext.motifs = res.motifs?.hits || [];
        this.userContext.wishlist = res.wishlist || [];
        const name = res.profile?.firstName || 'ami';
        this.addAssistantMessage(`👋 Bonjour ${name} ! Ravi de vous revoir. Prêt pour une séance de shopping intelligente ?`);
        this.isLoading = false;
      },
      error: () => {
        this.addAssistantMessage('✨ Bonjour ! Comment puis-je vous assister dans votre shopping aujourd\'hui ?');
        this.isLoading = false;
      }
    });
  }

  private addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: new Date() });
  }

  ngAfterViewChecked(): void {
    // Le scrollToBottom automatique ici bloquait l'utilisateur. Il est géré ailleurs.
  }

  toggleChat(): void {
    this.chatService.toggleChat(!this.isOpen);
    if (!this.isOpen) this.isFullScreen = false; // Reset if closed
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

    const loadingMsg: Message = { role: 'assistant', content: '', timestamp: new Date(), loading: true };
    this.messages.push(loadingMsg);

    try {
      const response = await this.chatService.sendMessage(this.conversationHistory, this.userContext);
      const idx = this.messages.indexOf(loadingMsg);
      
      // On prépare le message avec un contenu vide
      this.messages[idx] = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        products: response.products
      };
      
      this.conversationHistory.push({ role: 'assistant', content: response.text });
      if (this.conversationHistory.length > 20) this.conversationHistory = this.conversationHistory.slice(-20);
      
      // Effet d'écriture (streaming) : 3 caractères par ms / tick
      const fullText = response.text;
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
      }, 5); // 5ms pour une écriture très rapide et fluide

    } catch {
      const idx = this.messages.indexOf(loadingMsg);
      this.messages[idx].content = 'Désolé, une erreur est survenue lors de la communication avec Barsha AI.';
      this.messages[idx].loading = false;
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
      content: '📷🔎 Recherche de similarité d’articles par image',
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
      const summaryText = `Voici un look **${d.title_guess || 'tendance'}** basé sur votre image. 💎`;

      this.messages[idx] = {
        role: 'assistant',
        content: summaryText,
        timestamp: new Date(),
        isLikeThis: true,
        detected: d,
        products: result.similaires,
        complementProducts: result.complements
      };

      this.quickReplies = ['Voir plus chic ✨', 'Moins cher 💸', 'Ajouter des chaussures 👟'];

    } catch {
      const idx = this.messages.indexOf(loadingMsg);
      this.messages[idx].content = 'Désolé, je n\'ai pas pu analyser cette image. Réessayez avec une autre photo.';
      this.messages[idx].loading = false;
    } finally {
      this.isLoading = false;
    }
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
