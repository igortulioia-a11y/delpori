import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const sendWhatsAppSchema = z.object({
  telefone: z
    .string()
    .min(10, "Telefone inválido")
    .max(20, "Telefone inválido")
    .regex(/^[\d\s()+\-]+$/, "Telefone contém caracteres inválidos"),
  mensagem: z
    .string()
    .min(1, "Mensagem obrigatória")
    .max(4096, "Mensagem muito longa (máx 4096 caracteres)"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("E-mail inválido").max(254, "E-mail muito longo"),
  permissoes: z
    .array(
      z.enum([
        "dashboard",
        "conversas",
        "pedidos",
        "produtos",
        "automacoes",
        "configuracoes",
      ])
    )
    .default([]),
});

export const deleteMemberSchema = z.object({
  memberId: z.string().uuid("ID do membro inválido"),
});

export const updateMemberSchema = z.object({
  memberId: z.string().uuid("ID do membro inválido"),
  permissoes: z.array(
    z.enum([
      "dashboard",
      "conversas",
      "pedidos",
      "produtos",
      "automacoes",
      "configuracoes",
    ])
  ),
});

export const importMenuItemSchema = z.object({
  nome: z.string().min(1).max(200),
  descricao: z.string().max(1000).optional().nullable(),
  preco: z.number().min(0).max(99999),
  categoria: z.string().max(100).optional().nullable(),
  imagemUrl: z.string().url().max(2048).optional().nullable(),
});

export const importMenuSchema = z.object({
  items: z.array(importMenuItemSchema).min(1).max(500),
  skipDuplicates: z.boolean().default(true),
});

export const sendCampaignMessageSchema = z.object({
  campaignId: z.string().uuid("ID da campanha inválido"),
  telefone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^[\d\s()+\-]+$/),
  mensagem: z.string().min(1).max(4096),
  customerId: z.string().uuid("ID do cliente inválido"),
});

export const notifyOrderStatusSchema = z.object({
  orderId: z.string().uuid("ID do pedido inválido"),
});

export const notifyKitchenSchema = z.object({
  orderId: z.string().uuid("ID do pedido inválido"),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Valida uma URL externa para download de imagens.
 * Bloqueia IPs privados, localhost, e metadata endpoints para prevenir SSRF.
 */
export function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Apenas HTTPS
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Bloquear localhost
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
      return false;

    // Bloquear IPs privados (RFC 1918) e metadata endpoints
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // link-local + cloud metadata
      /^0\./, // 0.0.0.0/8
      /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,  // CGN (100.64/10)
    ];

    if (privatePatterns.some((p) => p.test(hostname))) return false;

    // Bloquear cloud metadata hostnames comuns
    const blockedHosts = [
      "metadata.google.internal",
      "metadata.google.com",
    ];
    if (blockedHosts.includes(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

type ParseSuccess<T> = { success: true; data: T };
type ParseError = { success: false; error: string };
export type ParseResult<T> = ParseSuccess<T> | ParseError;

/**
 * Valida e parseia body JSON com zod schema.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
  maxBodySize = 1024 * 1024 // 1MB default
): Promise<ParseResult<T>> {
  // Checar Content-Length
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > maxBodySize) {
    return { success: false, error: "Request body muito grande" };
  }

  try {
    const raw = await request.json();
    const result = schema.safeParse(raw);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return { success: false, error: firstError?.message ?? "Dados inválidos" };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "JSON inválido" };
  }
}
