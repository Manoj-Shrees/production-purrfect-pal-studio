import { Component, forwardRef } from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import { SelectskillService } from '../../../Service/SelectSkill/selectskill.service';

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';


@Component({
  selector: 'app-dropdown',
  standalone: true,
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.css',
  imports: [MatFormFieldModule, MatSelectModule, FormsModule, ReactiveFormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DropdownComponent),
    multi: true
  }]
})
export class DropdownComponent {


  value: any = [];

  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value || [];
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // Call this when selection changes
  updateSelectedSkills(newValue: any) {
    this.value = newValue;
    this.onChange(this.value);
    this.onTouched();
  }

  skillselection = new FormControl('');
  skillselectionlist: string[] = ['Logo Design', 'Digital Art', 'Vector Art', '3D Art', '2D Animation'];

constructor(private skills: SelectskillService){}

selectingskills(skills: any){
  this.skills.setskill(this.skillselection); 

  return skills;
}


}


