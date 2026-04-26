import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Title, Meta } from '@angular/platform-browser';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { AnalyticsService } from './services/analytics.service';
import { ScrollPositionService } from './services/scroll-position.service';

export const appConfig: ApplicationConfig = {
  providers:
    [provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withEnabledBlockingInitialNavigation(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'disabled',
        anchorScrolling: 'enabled'
      })
    ),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideMarkdown(),
    provideClientHydration(),
    // Service worker: only in prod builds, registers after the app is interactive.
    // Serves cached shell instantly behind a CDN; API data is revalidated in background.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
      Title,
      Meta,
      AnalyticsService,
      ScrollPositionService
    ]
};
