import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase-admin";
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

    const { telefone, mensagem } = parsed.data;
    const result = await sendWhatsApp(userId, telefone, mensagem);

    if (!result.success) {
      return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
