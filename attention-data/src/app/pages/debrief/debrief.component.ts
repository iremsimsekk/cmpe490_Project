import { Component } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-debrief',
  templateUrl: './debrief.component.html'
})
export class DebriefComponent {

  // Seçilen AI olduğu düşünülen video ID'leri
  selectedAI = new Set<string>();

  constructor(public session: SessionService, private router: Router) {}

  // Görsele tıklayınca seç / bırak
  toggleAI(id: string) {
    if (this.selectedAI.has(id)) {
      this.selectedAI.delete(id);
    } else {
      this.selectedAI.add(id);
    }
  }

  finish() {
    // 👉 Seçimleri session'a kaydet
    this.session.setSuspectedAI(Array.from(this.selectedAI));

    // Upload zaten experiment sonunda yapıldığı için
    // burada tekrar upload YOK
    this.router.navigateByUrl('/');
  }
}
