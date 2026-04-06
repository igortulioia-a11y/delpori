import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { telefone, mensagem } = await request.json();

    if (!telefone || !mensagem) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const result = await sendWhatsApp(userId, telefone, mensagem);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
