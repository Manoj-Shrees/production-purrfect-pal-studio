import { NgModule } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServerRendering, ServerModule } from '@angular/platform-server';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';

@NgModule({
  imports: [AppModule, ServerModule],
  providers: [
    provideServerRendering(),
    provideClientHydration(), // ✅ required for SSR hydration to work on client
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}