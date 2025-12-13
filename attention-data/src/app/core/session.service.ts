// src/app/core/session.service.ts
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export type Condition = 'free' | 'task';
export type Kind = 'real' | 'ai';

export interface ClickEvent {
  x: number;
  y: number;
  t: number;
}

export interface Trial {
  id: string;
  src: string;
  kind: Kind;
  condition: Condition;
  instruction?: string | null;
  clicks: ClickEvent[];
  replayCount?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  // ===== STATE =====
  condition: Condition = 'free';
  trials: Trial[] = [];
  currentIndex = 0;
  participantId: string | number = 'P001';

  // JSON’dan gelen tüm videolar
 allVideos: any[] = (window as any).videosJson || [];


  constructor(private http: HttpClient) {}

  // ===== STORAGE KEY =====
  private storageKey(): string {
    return `experimentData_${this.participantId}`;
  }

  // ===== JSON’DAN DOĞRU INSTRUCTION GETİR =====
  private findInstruction(cid: number, kind: Kind): string | null {
    const id = `c${cid}_${kind}`;
    const match = this.allVideos.find(v => v.id === id);
    return match?.instruction ?? null;
  }

  // ===== LEGACY INIT (kullanılıyor olabilir) =====
  init(
    condition: Condition,
    videos: { id: string; src: string; kind: Kind; instruction?: string }[]
  ) {
    this.condition = condition;
    this.trials = videos.map((v) => ({
      ...v,
      condition,
      clicks: [] as ClickEvent[],
    }));
    this.currentIndex = 0;
  }

  // ===== DENGELİ RANDOM + KARŞI DENGELİ INIT =====
  initBalanced(
    
    participantId: string | number,
    opts?: {
      contentCount?: number;
      basePath?: string;
      orderCounterbalance?: boolean;
    }
  ) {
    

    this.participantId = participantId;
    this.allVideos = (window as any).videosJson || [];
    const contentCount = opts?.contentCount ?? 12;
    const basePath = opts?.basePath ?? 'assets/videos';

    const pidNum = this.hashToNumber(participantId);
    const parity = pidNum % 2; // 0 veya 1

    const half = contentCount / 2;
    const freeIds = parity ? this.range(1, half) : this.range(half + 1, contentCount);
    const taskIds = parity ? this.range(half + 1, contentCount) : this.range(1, half);

    const buildSrc = (cid: number, kind: Kind) => `${basePath}/c${cid}_${kind}.mp4`;

    const makeTrials = (ids: number[], condition: Condition): Trial[] =>
      ids.map((cid) => {
        const isAI = ((cid + parity) % 2 === 0); // 5 AI, 5 real dağılımı
        const kind: Kind = isAI ? 'ai' : 'real';

        return {
          id: `c${cid}_${kind}`,
          src: buildSrc(cid, kind),
          condition,
          kind,
          // 🎯 JSON’daki gerçek instruction burada atanıyor!
          instruction: condition === 'task'
            ? this.findInstruction(cid, kind)
            : null,
          clicks: [],
        };
      });

    // shuffle
    const rng = this.mulberry32(0xC0FFEE ^ pidNum);
    const freeTrials = this.shuffle(makeTrials(freeIds, 'free'), rng);
    const taskTrials = this.shuffle(makeTrials(taskIds, 'task'), rng);

    // blok sırası counterbalance
    const swap = !!opts?.orderCounterbalance && parity === 0;
    this.trials = swap ? [...taskTrials, ...freeTrials] : [...freeTrials, ...taskTrials];

    this.currentIndex = 0;
  }

  // ===== AKIŞ =====
  current(): Trial | null {
    return this.trials[this.currentIndex] ?? null;
  }

  next(): Trial | null {
    if (this.currentIndex < this.trials.length - 1) {
      this.currentIndex++;
      return this.current();
    }
    return null;
  }

  isLast(): boolean {
    return this.currentIndex >= this.trials.length - 1;
  }

  // ===== KAYIT =====
  saveClick(x: number, y: number, t: number) {
    const trial = this.current();
    if (!trial) return;
    trial.clicks.push({ x, y, t });
    console.log(`Click @ x:${x.toFixed(3)}, y:${y.toFixed(3)}, t:${t.toFixed(2)}`);
  }

  saveTrial() {
    const trial = this.current();
    if (!trial) return;

    const key = this.storageKey();
    const saved: Trial[] = JSON.parse(localStorage.getItem(key) || '[]');

    const idx = saved.findIndex((t) => t.id === trial.id);
    if (idx >= 0) {
      saved[idx] = trial;
      console.log(`🔁 Trial updated (${trial.id})`);
    } else {
      saved.push(trial);
      console.log(`💾 Trial saved (${trial.id})`);
    }
    localStorage.setItem(key, JSON.stringify(saved, null, 2));
  }

  exportAll() {
    const key = this.storageKey();
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    const payload = {
      participantId: this.participantId,
      trials: all as Trial[],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `participant_${this.participantId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== HELPERS =====
  private range(a: number, b: number): number[] {
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }

  private mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private shuffle<T>(arr: T[], rng: () => number): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private hashToNumber(id: string | number): number {
    if (typeof id === 'number') return id;
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = Math.imul(31, h) + id.charCodeAt(i) | 0;
    }
    return Math.abs(h);
  }

// ===== FORM ENDPOINT UPLOAD (Formspree) =====
async uploadToServer() {
  const key = this.storageKey();

  const payload = {
    participantId: this.participantId,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screen: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    trials: JSON.parse(localStorage.getItem(key) || '[]')
  };

  try {
    const res = await lastValueFrom(
      this.http.post(
        'https://formspree.io/f/mpwvkwdo', // 🔴 BURAYA kendi Formspree endpoint'ini yaz
        payload,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )
    );

    console.log('✅ Veri başarıyla Formspree’ye gönderildi:', res);
  } catch (err) {
    console.error('❌ Formspree veri gönderimi başarısız:', err);
  }

  // Fail-safe: local JSON download
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_P${this.participantId}_${Date.now()}.json`;
  a.click();
  window.URL.revokeObjectURL(url);

  // 🔄 Yeni participant için reset
  this.resetForNextParticipant();
}

// ===== NEXT PARTICIPANT RESET =====
resetForNextParticipant() {
  const key = this.storageKey();

  // 🔹 Sadece bu participant'in verisini sil
  localStorage.removeItem(key);

  // 🔹 State sıfırla
  this.trials = [];
  this.currentIndex = 0;
  this.condition = 'free';

  // 🔹 Participant ID'yi temizle (yeni ID girilecek)
  this.participantId = '';

  console.log('🔄 Next participant için state resetlendi');
}


}
