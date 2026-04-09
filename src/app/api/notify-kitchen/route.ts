import { NextResponse } from "next/server";
import { getAuthUserId, supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsApp } from "@/lib/whatsapp";
import { parseBody, notifyKitchenSchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const pagamentoLabel: Record<string, string> = {
  pix: "PIX",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  vale_refeicao: "Vale-refeição",
};

/**
 * Notifica a cozinha via WhatsApp quando o dono altera os itens de um pedido
 * no painel. Chamada fire-and-forget pelo frontend em pedidos/page.tsx dentro
 * do handler saveChanges do OrderDetailSheet.
 *
 * Diferente do notify-order-status (que avisa o CLIENTE), este avisa a COZINHA
 * buscando profiles.telefone_cozinha. Monta uma mensagem com o estado completo
 * do pedido (novo lista de itens + total atualizado) pra cozinha refazer a
 * preparacao visualmente.
 *
 * Protecoes contra spam:
 * - Rate limit 50/hora por usuario
 * - Skip silencioso se o usuario nao configurou telefone_cozinha
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const rl = checkRateLimit(
      `notify-kitchen:${userId}`,
      RATE_LIMITS.notifyKitchen,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas notificacoes. Aguarde." },
        { status: 429 },
      );
    }

    const parsed = await parseBody(request, notifyKitchenSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Busca telefone da cozinha (profile)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("telefone_cozinha")
      .eq("id", userId)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Erro ao buscar perfil" },
        { status: 500 },
      );
    }

    if (!profile?.telefone_cozinha) {
      return NextResponse.json({
        skipped: true,
        reason: "sem_telefone_cozinha",
      });
    }

    // Busca pedido + items + customer
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id, numero, total, pagamento, endereco_entrega, observacao,
        customers ( nome, telefone ),
        order_items ( nome, quantidade, preco_unit, observacao )
      `,
      )
      .eq("id", parsed.data.orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido nao encontrado" },
        { status: 404 },
      );
    }

    const customersField = order.customers as
      | { nome: string | null; telefone: string | null }
      | { nome: string | null; telefone: string | null }[]
      | null;
    const customer = Array.isArray(customersField)
      ? customersField[0]
      : customersField;
    const clienteNome = customer?.nome || "Cliente";

    const items = (order.order_items as Array<{
      nome: string;
      quantidade: number;
      preco_unit: number;
      observacao: string | null;
    }> | null) || [];

    if (items.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason: "sem_itens",
      });
    }

    const itemsText = items
      .map((i) => {
        const obs = i.observacao ? ` (${i.observacao})` : "";
        return `• ${i.quantidade}x ${i.nome}${obs}`;
      })
      .join("\n");

    const pagLabel = order.pagamento
      ? pagamentoLabel[order.pagamento] || order.pagamento
      : "—";

    const totalFmt = `R$ ${(order.total ?? 0).toFixed(2).replace(".", ",")}`;

    const mensagem = [
      `*PEDIDO ALTERADO #${order.numero}*`,
      ``,
      `Cliente: ${clienteNome}`,
      ``,
      `*Itens atualizados:*`,
      itemsText,
      ``,
      `*Total:* ${totalFmt}`,
      `*Pagamento:* ${pagLabel}`,
      order.endereco_entrega ? `*Endereco:* ${order.endereco_entrega}` : null,
      order.observacao ? `*Obs:* ${order.observacao}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendWhatsApp(
      userId,
      profile.telefone_cozinha,
      mensagem,
    );
    if (!result.success) {
      return NextResponse.json(
        { error: "Falha ao enviar mensagem" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notify-kitchen error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
