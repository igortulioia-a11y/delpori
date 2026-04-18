import { NextResponse } from "next/server";
import { getAuthUserId, supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";
import { parseBody, sendCampaignMessageSchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Rate limit por usuario
    const rl = checkRateLimit(`campaign:${userId}`, RATE_LIMITS.sendCampaignMessage);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas mensagens. Aguarde um momento." },
        { status: 429 }
      );
    }

    // Validar body
    const parsed = await parseBody(request, sendCampaignMessageSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { campaignId, customerId, telefone, mensagem } = parsed.data;

    // Validar ownership da campanha (anti-IDOR)
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    // Se customerId foi enviado (lista vinda de customers), validar ownership
    if (customerId) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!customer) {
        return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
      }
    }

    const result = await sendWhatsApp(userId, telefone, mensagem);

    if (!result.success) {
      return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
