import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {

 private isLoggingEnabled = false;

  log(message?: any, ...optionalParams: any[]): void {
    if (this.isLoggingEnabled) {
      console.log(message, ...optionalParams);
    }
  }

  warn(message?: any, ...optionalParams: any[]): void {
    if (this.isLoggingEnabled) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message?: any, ...optionalParams: any[]): void {
    if (this.isLoggingEnabled) {
      console.error(message, ...optionalParams);
    }
  }

  info(message?: any, ...optionalParams: any[]): void {
    if (this.isLoggingEnabled) {
      console.info(message, ...optionalParams);
    }
  }

}
