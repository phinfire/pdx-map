import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, LOCALE_ID, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { IconRegistryService } from '../services/icon-registry.service';
import { MAT_DATE_LOCALE } from '@angular/material/core';

registerLocaleData(localeDe);

const getLocale = (): string => {
  if (typeof navigator === 'undefined') return 'en-US';
  const browserLang = navigator.language;
  const supportedLocales = ['de', 'en-US'];
  if (supportedLocales.includes(browserLang)) {
    return browserLang;
  }
  const langPrefix = browserLang.split('-')[0];
  if (supportedLocales.includes(langPrefix)) {
    return langPrefix;
  }
  return 'en-US';
};

const locale = getLocale();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideHttpClient(),
    provideAnimationsAsync(),
    {
      provide: LOCALE_ID,
      useValue: locale
    },
    {
      provide: MAT_DATE_LOCALE,
      useValue: locale
    },
    provideAppInitializer(() => {
      const iconRegistry = inject(IconRegistryService);
      return iconRegistry.registerIcons();
    })
  ]
};