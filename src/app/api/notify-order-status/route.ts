import { NextResponse } from "next/server";
import { getAuthUserId, supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";
import { parseBody, notifyOrderStatusSchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const MSG_SAIU_ENTREGA = "Seu pedido saiu para entrega";

/**
 * Notifica o cliente via WhatsApp quando o pedido sai pra entrega.
 * Chamada fire-and-forget pelo frontend em pedidos/page.tsx quando o
 * status muda de `em_preparo` para `saiu_entrega`.
 *
 * Protecoes contra spam:
 * - Rate limit 20/hora por usuario
 * - `notified_saiu_entrega_at` garante 1 notificacao por pedido mesmo se
 *   o dono trocar o status ida e volta
 * - Ignora pedidos criados ha mais de 4 horas (evita notificar pedidos
 *   antigos presos em `em_preparo` quando o dono finalmente atualiza)
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    // Rate limit por usuario
    const rl = checkRateLimit(
      `notify-order-status:${userId}`,
      RATE_LIMITS.notifyOrderStatus
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas notificacoes. Aguarde." },
        { status: 429 }
      );
    }

    const parsed = await parseBody(request, notifyOrderStatusSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Buscar pedido + telefone do cliente
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, status, criado_em, notified_saiu_entrega_at, customers ( telefone )"
      )
      .eq("id", parsed.data.orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido nao encontrado" },
        { status: 404 }
      );
    }

    // Validacoes (skipa em vez de erro — chamada fire-and-forget do frontend)
    if (order.status !== "saiu_entrega") {
      return NextResponse.json({
        skipped: true,
        reason: "status_diferente_de_saiu_entrega",
      });
    }

    if (order.notified_saiu_entrega_at) {
      return NextResponse.json({ skipped: true, reason: "ja_notificado" });
    }

    // Anti-fallback: nao notificar pedidos antigos (>4h)
    const criadoEm = new Date(order.criado_em);
    const limiteAntigo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    if (criadoEm < limiteAntigo) {
      return NextResponse.json({
        skipped: true,
        reason: "pedido_antigo_mais_de_4h",
      });
    }

    // Supabase retorna customers como array (embed). Pegar o primeiro.
    const customersField = order.customers as
      | { telefone: string | null }
      | { telefone: string | null }[]
      | null;
    const customer = Array.isArray(customersField)
      ? customersField[0]
      : customersField;
    const telefone = customer?.telefone;
    if (!telefone) {
      return NextResponse.json(
        { error: "Cliente sem telefone cadastrado" },
        { status: 400 }
      );
    }

    // Enviar via Evolution
    const result = await sendWhatsApp(userId, telefone, MSG_SAIU_ENTREGA);
    if (!result.success) {
      return NextResponse.json(
        { error: "Falha ao enviar mensagem" },
        { status: 500 }
      );
    }

    // Marcar como notificado PRIMEIRO (anti-race: se duas requisicoes vierem
    // ao mesmo tempo, a segunda vai ver `notified_saiu_entrega_at` preenchido)
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ notified_saiu_entrega_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Erro ao marcar notified_saiu_entrega_at:", updateError);
    }

    // Salvar no historico de messages (aparece na conversa do cliente no painel)
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("cliente_tel", telefone)
      .maybeSingle();

    if (conversation?.id) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversation.id,
        user_id: userId,
        remetente: "ia",
        conteudo: MSG_SAIU_ENTREGA,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notify-order-status error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
