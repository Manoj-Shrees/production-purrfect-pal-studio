import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SociallinkService {

   private sociallinks =
    ["https://www.instagram.com/purrfectpalstudio?igsh=bXN2ZzJqMGoxOTBn",
      "https://www.facebook.com/people/Purrfect-Pal-Studio/100089166527311/",
    "https://www.tiktok.com/@purrfectpalstudio?_t=ZS-8w5kxQedBTR&_r=1"];

  constructor() { }


  geturl(pos: number){
    window.open(this.sociallinks[pos], "_blank");
  }

}
