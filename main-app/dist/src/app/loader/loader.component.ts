import { Component } from '@angular/core';
import { LoaderService } from '../Service/app/loader.service';

@Component({
  selector: 'app-loader',
  standalone: false,
  
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css'
})
export class LoaderComponent {

  constructor(public loader: LoaderService){}

}
