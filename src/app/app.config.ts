import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Title, Meta } from '@angular/platform-browser';
import { provideClientHydration } from '@angular/platform-browser';
import { AnalyticsService } from './services/analytics.service';
import { ScrollPositionService } from './services/scroll-position.service';

export const appConfig: ApplicationConfig = {
  providers:
    [provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withEnabledBlockingInitialNavigation(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'disabled', // We'll handle this manually
        anchorScrolling: 'enabled'
      })
    ),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideMarkdown(),
    provideClientHydration(),
      Title,
      Meta,
      AnalyticsService,
      ScrollPositionService
    ]
};
