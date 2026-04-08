import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class SelectskillService {

private skillsselect : FormControl | undefined;

  constructor() { }

  setskill(skills: FormControl){
 this.skillsselect = skills;
  }


  getskill(){

    return this.skillsselect;
  }

}
