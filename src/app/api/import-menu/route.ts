import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase-admin";
import { UaiRangoClient } from "@/lib/uairango";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

const importMenuFetchSchema = z.object({
  merchantToken: z.string().min(1, "Token obrigatório").max(500),
});

/**
 * POST /api/import-menu
 * Busca cardapio do UaiRango via API oficial.
 * Body: { merchantToken: string }
 * Retorna: { success, restaurante, items[] }
 */
export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Rate limit
  const rl = checkRateLimit(`import-fetch:${userId}`, RATE_LIMITS.importMenu);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });
  }

  // Validar body
  const parsed = await parseBody(req, importMenuFetchSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const clientId = process.env.UAIRANGO_CLIENT_ID;
  const clientSecret = process.env.UAIRANGO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Integração UaiRango não configurada. Entre em contato com o suporte." },
      { status: 500 }
    );
  }

  try {
    const client = new UaiRangoClient(clientId, clientSecret);
    const result = await client.fetchMenu(parsed.data.merchantToken.trim());

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[import-menu] Erro:", err.message);
    return NextResponse.json(
      { error: "Erro ao buscar cardápio. Tente novamente." },
      { status: 500 }
    );
  }
}
