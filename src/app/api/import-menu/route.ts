import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase-admin";
import { UaiRangoClient } from "@/lib/uairango";

/**
 * POST /api/import-menu
 * Busca cardapio do UaiRango via API oficial.
 * Body: { merchantToken: string }
 * Retorna: { success, restaurante, items[] }
 */
export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { merchantToken } = await req.json();
  if (!merchantToken?.trim()) {
    return NextResponse.json({ error: "Token do estabelecimento é obrigatório" }, { status: 400 });
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
    const result = await client.fetchMenu(merchantToken.trim());

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[import-menu] Erro:", err.message);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar cardápio do UaiRango" },
      { status: 500 }
    );
  }
}
