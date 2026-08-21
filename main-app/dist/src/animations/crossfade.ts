import { trigger, state, style, transition,
    animate, group, query, stagger, keyframes
} from '@angular/animations';

export const crossfade = [
    trigger('crossfade', [
        transition(':enter <=> :leave', [
          group([
            query('.active', [
              style({ opacity: 0, scale: 0.7 })
            ]),
            query(':not(.active)', [
                animate('0.5s ease-out', 
                  style({ opacity: 0, scale: 0.7 }))
            ]),
            query('.active', [
                animate('0.5s ease-in',
                  style({ opacity: 1, scale: 1 }))
            ])
          ])
        ])
      ]),
]
