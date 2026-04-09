/**
 * Toca beeps simples usando a Web Audio API, sem precisar de assets de audio.
 *
 * Browsers modernos bloqueiam autoplay ate o usuario interagir com a pagina
 * pela primeira vez. Se play falhar (e.g., AudioContext suspended), o erro
 * e ignorado silenciosamente e o som nao toca ate o primeiro clique.
 */

let audioCtx: AudioContext | null = null;
let lastPlayAt = 0;
const DEBOUNCE_MS = 500;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

type OscType = "sine" | "triangle" | "square" | "sawtooth";

function beep(
  frequency: number,
  duration: number,
  delayMs = 0,
  volume = 0.45,
  oscType: OscType = "triangle",
) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    // Retoma se estiver suspenso (autoplay policy apos interacao do user)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = oscType;
    osc.frequency.value = frequency;

    const startTime = ctx.currentTime + delayMs / 1000;
    const endTime = startTime + duration / 1000;

    // Envelope: ataque rapido (15ms) + decay exponencial natural (tipo sino)
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc.start(startTime);
    osc.stop(endTime);
  } catch {
    // Silenciar — nao e critico se o som nao tocar
  }
}

/**
 * Som de novo pedido: 5 "ding-dongs" em sequencia (~4s total).
 * Cada ding-dong e uma nota aguda seguida de uma grave (tipo campainha).
 * Simula campainha tradicional de porta/balcao.
 */
export function playNewOrderSound() {
  const now = Date.now();
  if (now - lastPlayAt < DEBOUNCE_MS) return;
  lastPlayAt = now;

  // Cada ding-dong ocupa ~800ms. 5x = ~4000ms total.
  // Ding: E6 (1318Hz) agudo, curto
  // Dong: A5 (880Hz) grave, sustentado
  const STEP = 800;

  for (let i = 0; i < 5; i++) {
    const base = i * STEP;
    // Ding agudo
    beep(1318, 260, base, 0.55, "triangle");
    // Dong grave (sobrepoe levemente pra transicao suave)
    beep(880, 480, base + 280, 0.55, "triangle");
  }
}

/**
 * Som de "precisa de atendimento humano": 2 notas graves sustentadas
 * (~1s total). Tom de aviso, nao tao urgente quanto novo pedido.
 */
export function playHumanNeededSound() {
  const now = Date.now();
  if (now - lastPlayAt < DEBOUNCE_MS) return;
  lastPlayAt = now;

  // A4 → E4 (descendo, tom de "atencao")
  beep(440, 350, 0, 0.5, "triangle");
  beep(330, 500, 400, 0.5, "triangle");
}
