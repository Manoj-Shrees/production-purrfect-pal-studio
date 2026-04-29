import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'tableFilter',
  standalone: false
})
export class TableFilterPipe implements PipeTransform {

  transform(items: any[], searchText: string): any[] {
    if (!items) return [];
    if (!searchText) return items;
    
    searchText = searchText.toLowerCase();
    
    return items.filter(item => 
      Object.values(item).some(val => 
        val !== null && val !== undefined && val.toString().toLowerCase().includes(searchText)
      )
    );
  }

}
