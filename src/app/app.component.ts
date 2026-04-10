import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, NavigationStart } from '@angular/router';
import { NavbarComponent } from './components/commun/navbar/navbar.component';
import { FooterComponent } from './components/commun/footer/footer.component';
import { ChatbotComponent } from './components/commun/chatbot/chatbot.component';


import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { TitleService } from './services/title.service';
import { MetaService } from './services/meta.service';
import { AnalyticsService } from './services/analytics.service';
import { ScrollPositionService } from './services/scroll-position.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, CommonModule, ChatbotComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Barsha';
  isHomePage = false;
  private routerSubscription: Subscription;
  private currentUrl = '';
  showWelcomePopup = true;

  constructor(
    private router: Router,
    private titleService: TitleService,
    private metaService: MetaService,
    private analyticsService: AnalyticsService,
    private scrollPositionService: ScrollPositionService
  ) {
    // Track route changes for home page detection
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd || event instanceof NavigationStart))
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          // Save scroll position before navigation
          this.saveCurrentScrollPosition();
        } else if (event instanceof NavigationEnd) {
          // Update home page status
          this.isHomePage =
            event.url === '/' ||
            event.url === '/home' ||
            event.urlAfterRedirects === '/' ||
            event.urlAfterRedirects === '/home';

          // Update current URL
          this.currentUrl = event.urlAfterRedirects || event.url;
        }
      });

    // Tracking scroll utilisateur
    const scrollThresholds = [25, 50, 75, 100];
    const reached = new Set<number>();
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = Math.round((scrollTop / docHeight) * 100);
      scrollThresholds.forEach(threshold => {
        if (percent >= threshold && !reached.has(threshold)) {
          this.analyticsService.scroll(threshold);

          
          reached.add(threshold);
        }
      });
    });
  }

  ngOnInit() {
    // Initialize scroll position service (it will handle scroll restoration automatically)
    // The service is injected and will start tracking immediately

    // Scroll to top immediately when component initializes (only for initial load)
    if (!this.currentUrl) {
      window.scrollTo(0, 0);
    }

    // Initialize title service to track route changes
    this.titleService.initTitleService();

    // Initialize canonical service to point HTTP URLs to HTTPS
    this.metaService.initCanonicalService();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  /**
   * Save current scroll position before navigation
   * Note: The ScrollPositionService now handles this automatically in NavigationStart
   */
  private saveCurrentScrollPosition(): void {
    // This method is kept for compatibility but the actual scroll position saving
    // is now handled automatically by the ScrollPositionService in NavigationStart events
    // to avoid conflicts and ensure proper timing
  }

  onCloseWelcomePopup() {
    this.showWelcomePopup = false;
  }
}
