import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'src/app/core/session.service';
// ⭐ 1) JSON'u import etme
import videosJson from '../../../assets/videos/videos.json';
@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss']
})
export class IntroComponent {
  participantId: string = '';

  constructor(private router: Router, private session: SessionService) {}

  // Katılımcı ID’sini otomatik oluştur veya varsa yükle
  ngOnInit() {

       // ⭐ 2) JSON'u GLOBAL'e yaz (BUNU EKLE)
    (window as any).videosJson = videosJson;

    const savedId = localStorage.getItem('participant_id');
    if (savedId) {
      this.participantId = savedId;
    } else {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      this.participantId = `P_${date}_${randomNum}`;
      localStorage.setItem('participant_id', this.participantId);
    }

    console.log('🎯 Katılımcı ID:', this.participantId);
    console.log('🎬 JSON yükledi:', videosJson);
  }

  startExperiment() {
    // ✅ Session’ı başlat ve ID’yi gönder
    this.session.initBalanced(this.participantId, { orderCounterbalance: true });
    this.router.navigateByUrl('/experiment');
  }
}
