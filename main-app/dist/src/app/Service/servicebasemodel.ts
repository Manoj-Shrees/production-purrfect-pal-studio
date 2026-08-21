export const hosturl = "https://purrfectpal.studio";
export const baseurl = "https://purrfectpal.studio/api";
export const uploadbaseurl = "https://purrfectpal.studio/upload";
export const basefileurl = "https://purrfectpal.studio/uploadedfiles/Images/";
export const stripeapiurl = "https://purrfectpal.studio/create-payment-intent";

export interface Message {
  Message_ID: number;
  Order_ID: string;
  username: string;
  role: string;
  text: string;
  date?: string;  // Optional field
  Url?: string;   // Optional field
  Pro_url?: string; // Optional field
}

import { environment } from '../../environments/environment';

export const headers = {
  'Content-Type': 'application/json',
  'X-Proxy-Key': environment.apiKey
}

export const fileheaders = {
  'X-Proxy-Key': environment.apiKey
}

// ✅ Use httpOptions for all authenticated API calls — bundles proxy key +
// withCredentials in one place as a backup for services that don't go through
// the AuthInterceptor (e.g. direct HttpClient calls with custom options).
export const httpOptions = {
  headers: headers,
  withCredentials: true
} as const;

export const fileHttpOptions = {
  headers: fileheaders,
  withCredentials: true
} as const;

export const stripeApiKey = "pk_live_51QZ0jqCr1bc7EQACqZqkOVdRA8KTakavMewoC7IaQkM5rhBV3R38YPaAfhvyxtc75Gljnu4SVkT22t8Xe6n1cfHc00N8sGTGOa";
