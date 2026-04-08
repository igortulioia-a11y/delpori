/**
 * Rate limiter in-memory simples para API routes.
 * Funciona por instancia serverless — nao e perfeito, mas ja previne abusos basicos.
 * Para producao robusta, migrar para @upstash/ratelimit com Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpar entries expiradas a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

interface RateLimitConfig {
  /** Maximo de requests permitidos na janela */
  limit: number;
  /** Janela de tempo em segundos */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Verifica rate limit para uma chave (IP, userId, etc).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Nova janela
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Extrai IP do request para rate limiting.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// ─── Presets de rate limit por rota ──────────────────────────────────────────

export const RATE_LIMITS = {
  /** /api/send-whatsapp: 10 msgs por minuto por usuario */
  sendWhatsApp: { limit: 10, windowSeconds: 60 },
  /** /api/invite-member: 5 convites por minuto */
  inviteMember: { limit: 5, windowSeconds: 60 },
  /** /api/restaurant-phone: 30 requests por minuto por IP */
  restaurantPhone: { limit: 30, windowSeconds: 60 },
  /** /api/import-menu: 5 imports por minuto */
  importMenu: { limit: 5, windowSeconds: 60 },
  /** /api/send-campaign-message: 60 msgs por minuto (1/s) */
  sendCampaignMessage: { limit: 60, windowSeconds: 60 },
  /** /api/notify-order-status: 20 notificacoes por hora por usuario (anti-spam WhatsApp) */
  notifyOrderStatus: { limit: 20, windowSeconds: 3600 },
} as const;
