// Feedback "juicy": vibración (haptics) en nativo + sonido SINTETIZADO en web
// (Web Audio API, sin ficheros de sonido). Todo es best-effort: si algo no está
// disponible, simplemente no suena/vibra. Pensado para reforzar la sensación de
// pique (tirar la ruleta, batir un récord, ganar).
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ── Web Audio (solo web) ─────────────────────────────────────────────────────
let ctx: any = null;
function audioCtx(): any {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as any;
  const AC = g.AudioContext || g.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // Muchos navegadores arrancan el contexto "suspended" hasta la 1ª interacción.
  if (ctx.state === 'suspended') ctx.resume?.();
  return ctx;
}

function beep(
  freq: number,
  durMs: number,
  type: string = 'triangle',
  gain = 0.045,
  startAt = 0
): void {
  const c = audioCtx();
  if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

// ── API ──────────────────────────────────────────────────────────────────────

/** Clic corto: cada giro de la ruleta, selección. */
export function tick(): void {
  if (Platform.OS === 'web') {
    beep(900, 26, 'triangle', 0.028);
    return;
  }
  Haptics.selectionAsync().catch(() => {});
}

/** Golpe seco: revelar resultado, acción importante. */
export function impact(): void {
  if (Platform.OS === 'web') {
    beep(170, 90, 'square', 0.05);
    return;
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Fanfarria de victoria: ganar un pique, batir un récord. */
export function win(): void {
  if (Platform.OS === 'web') {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      beep(f, 200, 'triangle', 0.05, i * 0.09)
    );
    return;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}
