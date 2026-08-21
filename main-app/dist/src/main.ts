import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Disable console logs in production
if (environment.production) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  enableProdMode();
}

// Bootstrap the Angular application
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));
