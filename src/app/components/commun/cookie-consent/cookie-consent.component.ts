import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss'
})
export class CookieConsentComponent implements OnInit {
  showBanner = false;
  showPreferences = false;

  // Cookie preferences
  preferences = {
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false
  };

  private readonly CONSENT_KEY = 'barsha_cookie_consent';
  private readonly CONSENT_VERSION = '1.0';

  ngOnInit(): void {
    this.checkExistingConsent();
  }

  private checkExistingConsent(): void {
    const savedConsent = localStorage.getItem(this.CONSENT_KEY);

    if (savedConsent) {
      try {
        const consent = JSON.parse(savedConsent);
        if (consent.version === this.CONSENT_VERSION) {
          this.preferences = consent.preferences;
          this.applyConsent();
          return;
        }
      } catch (e) {
        // Invalid consent data, show banner
      }
    }

    // No valid consent, show banner after a short delay
    setTimeout(() => {
      this.showBanner = true;
    }, 1000);
  }

  acceptAll(): void {
    this.preferences = {
      necessary: true,
      analytics: true,
      marketing: true
    };
    this.saveAndApply();
  }

  rejectAll(): void {
    this.preferences = {
      necessary: true,
      analytics: false,
      marketing: false
    };
    this.saveAndApply();
  }

  savePreferences(): void {
    this.showPreferences = false;
    this.saveAndApply();
  }

  openPreferences(): void {
    this.showPreferences = true;
  }

  closePreferences(): void {
    this.showPreferences = false;
  }

  private saveAndApply(): void {
    const consent = {
      version: this.CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      preferences: this.preferences
    };

    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(consent));
    this.applyConsent();
    this.showBanner = false;
  }

  private applyConsent(): void {
    // Update Google consent mode
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': this.preferences.analytics ? 'granted' : 'denied',
        'ad_storage': this.preferences.marketing ? 'granted' : 'denied',
        'ad_user_data': this.preferences.marketing ? 'granted' : 'denied',
        'ad_personalization': this.preferences.marketing ? 'granted' : 'denied'
      });
    }

    // Push consent event to dataLayer for GTM
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        'event': 'cookie_consent_update',
        'cookie_consent_analytics': this.preferences.analytics,
        'cookie_consent_marketing': this.preferences.marketing
      });
    }
  }
}
