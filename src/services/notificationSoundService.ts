import { STORAGE_KEYS } from './storageKeys';
import { StorageAdapter } from './storageAdapter';
const PRESETS = {
  soft: { nameAr: 'هادئ', nameEn: 'Soft', freq: 660, duration: 0.18 },
  chime: { nameAr: 'رنين', nameEn: 'Chime', freq: 880, duration: 0.24 },
  bell: { nameAr: 'جرس', nameEn: 'Bell', freq: 740, duration: 0.35 },
  pop: { nameAr: 'نقرة', nameEn: 'Pop', freq: 520, duration: 0.12 },
} as const;

export type NotificationSoundId = keyof typeof PRESETS | 'custom' | 'off';
export interface NotificationSoundSettings { id: NotificationSoundId; customDataUrl?: string; volume: number; }

const KEY = STORAGE_KEYS.NOTIFICATION_SOUND;
const DEFAULT: NotificationSoundSettings = { id: 'soft', volume: 0.65 };

export const NotificationSoundService = {
  presets: PRESETS,
  getSettings(): NotificationSoundSettings {
    if (typeof window === 'undefined') return DEFAULT;
    try { return StorageAdapter.getItem<NotificationSoundSettings>(KEY, DEFAULT) ?? DEFAULT; } catch { return DEFAULT; }
  },
  saveSettings(settings: NotificationSoundSettings) {
    StorageAdapter.setItem(KEY, settings);
  },
  async play(settings = this.getSettings()) {
    if (typeof window === 'undefined' || settings.id === 'off') return;
    try {
      if (settings.id === 'custom' && settings.customDataUrl) {
        const audio = new Audio(settings.customDataUrl); audio.volume = settings.volume; await audio.play(); return;
      }
      const preset = PRESETS[settings.id as keyof typeof PRESETS];
      if (!preset) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = settings.id === 'bell' ? 'sine' : 'triangle';
      osc.frequency.value = preset.freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.02, settings.volume * 0.22), ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + preset.duration);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + preset.duration + 0.02);
      setTimeout(() => ctx.close().catch(() => {}), 500);
    } catch { /* browser autoplay policy */ }
  }
};
