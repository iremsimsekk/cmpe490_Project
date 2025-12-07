import { Component, ElementRef, ViewChild } from '@angular/core';
import { SessionService, Trial } from '../../core/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-experiment',
  templateUrl: './experiment.component.html',
  styleUrls: ['./experiment.component.scss']
})
export class ExperimentComponent {
  /** Video referansları */
  @ViewChild('videoBlur') videoBlur!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoSharp') videoSharp!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoContainer') videoContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('clickLayer') clickLayer!: ElementRef<HTMLDivElement>;


  /** Deney değişkenleri */
  trial: Trial | null = null;
  showTaskPopup = false;
  isBlurred = false;               // free'de true olacak
  videoEnded = false;
  clickMarkers: { x: number; y: number }[] = [];
  progress = 0;
  showNoClickPopup = false;
  clickCount = 0;
  clickLimit = 0;
  showLimitWarning = false;

  constructor(private session: SessionService, private router: Router) {}

  get isLastTrial(): boolean {
  return this.session.isLast();
}

    // 👇 mevcut getter zaten:
  get hasAnyClick(): boolean {
    return !!this.trial && this.trial.clicks && this.trial.clicks.length > 0;
  }

  /** Deney başlatıldığında */
  ngOnInit() {
    this.trial = this.session.current();

    // 🎯 Free koşulunda blur açık, task'ta kapalı
    this.isBlurred = this.trial?.condition === 'free';
    console.log(`Koşul: ${this.trial?.condition} → Blur: ${this.isBlurred}`);

    // Task koşulundaysa görev popup'ı aç
    if (this.trial?.condition === 'task') {
      this.showTaskPopup = true;
    }
  }

  ngAfterViewInit() {
 const blur = this.videoBlur?.nativeElement;
  const sharp = this.videoSharp?.nativeElement;

  if (blur) {
    blur.muted = true;
    blur.volume = 0;
  }

  if (sharp) {
    sharp.muted = true;
    sharp.volume = 0;
  }

  // aşağısı senin mevcut kodun:
  const video = this.videoBlur.nativeElement;

  if (!video) return;

  video.addEventListener('loadedmetadata', () => {
    video.muted = true;
    const ratio = video.videoWidth / video.videoHeight;
    this.videoContainer.nativeElement.style.setProperty('--ratio', ratio.toString());
    this.updateClickableArea();
  });

  window.addEventListener('resize', () => this.updateClickableArea());
}




  /** Görev popup'ı kapandığında task başlar */
startTask() {
  this.showTaskPopup = false;

  const video = this.videoBlur?.nativeElement;
  if (!video) return;

  if (video.readyState >= 1) {
    video.play();
  } else {
    video.addEventListener('loadeddata', () => video.play(), { once: true });
  }
}



onReveal(event: MouseEvent) {
  if (!this.trial || this.videoEnded) return;

  // Direct clickLayer reference
  const layer = this.clickLayer.nativeElement;
  const rect = layer.getBoundingClientRect();

  const xNorm = (event.clientX - rect.left) / rect.width;
  const yNorm = (event.clientY - rect.top) / rect.height;

  // Eğer layer dışında tıklanmışsa (siyah barlar): ignore
  if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) {
    console.log("⬛ Letterbox (siyah alana) tıklama → YOK SAYILDI");
    return;
  }

  // click limit
  const limit = this.trial.condition === 'task' ? 5 : 8;
  if (this.trial.clicks.length >= limit) {
    this.showLimitWarning = true;
    setTimeout(()=> this.showLimitWarning = false, 1500);
    return;
  }

  const t = this.videoBlur.nativeElement.currentTime;



  this.session.saveClick(xNorm, yNorm, t);
  this.clickCount = this.trial.clicks.length;

  // free mode blur effect
  if (this.trial.condition === 'free') {
    const sharp = this.videoSharp.nativeElement;
    sharp.style.setProperty('--x', `${xNorm * 100}%`);
    sharp.style.setProperty('--y', `${yNorm * 100}%`);
    sharp.style.setProperty('--r', `180px`);
    setTimeout(() => sharp.style.setProperty('--r', `0px`), 1000);
  }
}




  /** Tekrar izleme */
  replayTrial() {
    console.log("REPLAY FUNCTION CALLED!!");
    const blur = this.videoBlur.nativeElement;

    if (this.trial?.replayCount && this.trial.replayCount >= 1) {
      console.log('Replay limit reached');
      return;
    }

    if (this.trial) {
      this.trial.clicks = [];
      this.trial.replayCount = (this.trial.replayCount || 0) + 1;
    }

    blur.currentTime = 0;
    this.videoSharp.nativeElement.currentTime = 0;
    this.isBlurred = this.trial?.condition === 'free';
    this.videoEnded = false;
    this.clickMarkers = [];

    blur.play();
    console.log(`Trial replayed (${this.trial?.id}), clicks reset`);
  }

  /** Senkronizasyon fonksiyonları */
syncPlay() {
  if (this.trial?.condition === 'task') return; // task'ta senkron yok
  this.videoSharp?.nativeElement?.play().catch(() => {});
}

syncPause() {
  if (this.trial?.condition === 'task') return;
  this.videoSharp?.nativeElement?.pause();
}

syncTime() {
  if (this.trial?.condition === 'task') return;
  if (!this.videoBlur || !this.videoSharp) return;

  const blur = this.videoBlur.nativeElement;
  const sharp = this.videoSharp.nativeElement;
  const diff = Math.abs(blur.currentTime - sharp.currentTime);
  if (diff > 0.03) sharp.currentTime = blur.currentTime;
}

  /** Video bittiğinde */
  onEnded() {
    this.videoEnded = true;
    // 🔔 hiç tıklama yoksa uyarı popup'ını göster
  if (this.trial && this.trial.clicks.length === 0) {
    this.showNoClickPopup = true;
  }
    this.session.saveTrial();
  }

  /** Sonraki videoya geçiş */
  goNext() {
    this.videoEnded = false;
    this.clickCount = 0; 

    if (this.session.isLast()) {
      this.session.uploadToServer();
      this.router.navigateByUrl('/debrief');
      return;
    }

    this.session.next();
    this.trial = this.session.current();
    this.isBlurred = this.trial?.condition === 'free';
    this.clickMarkers = [];
    this.videoEnded = false;
    this.showNoClickPopup = false;

    // ❗ HER TASK trial'da popup aç
    if (this.trial?.condition === 'task') {
      this.showTaskPopup = true;
    }


    const blur = this.videoBlur?.nativeElement;
    blur?.load();

if (this.trial?.condition === 'free') {
  const sharp = this.videoSharp?.nativeElement;
  sharp?.load();
}


    blur.onplay = () => this.syncPlay();
    blur.onpause = () => this.syncPause();
    blur.ontimeupdate = () => this.syncTime();

    console.log(`▶️ Yeni video yüklendi: ${this.trial?.id} (Blur: ${this.isBlurred})`);
  }

  /** Üstte gösterilen ilerleme etiketi */
  get progressLabel(): string {
    const i = this.session.currentIndex + 1;
    const total = this.session.trials.length;
    return `${i} / ${total}`;
  }

  /** Oynat / durdur (manuel kontrol) */
  togglePlay() {
    const video = this.videoEl.nativeElement;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  /** İlerleme çubuğu ile sarma */
  seekVideo() {
    const video = this.videoEl.nativeElement;
    video.currentTime = (this.progress / 100) * video.duration;
  }

  updateClickableArea() {
  const container = this.videoContainer.nativeElement;
  const video = this.videoBlur.nativeElement;
  const layer = this.clickLayer.nativeElement;

  const CW = container.clientWidth;
  const CH = container.clientHeight;

  const VW = video.videoWidth;
  const VH = video.videoHeight;

  if (!VW || !VH) return;

  const containerRatio = CW / CH;
  const videoRatio = VW / VH;

  let width, height, offsetX, offsetY;

  if (containerRatio > videoRatio) {
    // Video yüksekliği container'a oturuyor
    height = CH;
    width = CH * videoRatio;
    offsetX = (CW - width) / 2;
    offsetY = 0;
  } else {
    // Video genişliği container'a oturuyor
    width = CW;
    height = CW / videoRatio;
    offsetX = 0;
    offsetY = (CH - height) / 2;
  }

  // Click-layer’ı gerçek video alanına oturt
  layer.style.left = offsetX + "px";
  layer.style.top = offsetY + "px";
  layer.style.width = width + "px";
  layer.style.height = height + "px";
  const SHIFT = 1;

layer.style.left = Math.round(offsetX) + "px";

// 1. TOP: Üst kenarı 1 piksel aşağı kaydır (offsetY'ye SHIFT ekle)
layer.style.top = Math.round(offsetY + SHIFT) + "px";

layer.style.width = Math.round(width) + "px";

// 2. HEIGHT: Top'tan kaynaklanan kaydırma kadar yüksekliği azalt (sadece 1*SHIFT kadar azalt)
layer.style.height = Math.round(height - SHIFT) + "px";
}



}

