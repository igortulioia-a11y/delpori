import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserId } from "@/lib/supabase-admin";
import {
  parseBody,
  inviteMemberSchema,
  deleteMemberSchema,
  updateMemberSchema,
} from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Rate limit
  const rl = checkRateLimit(`invite:${userId}`, RATE_LIMITS.inviteMember);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitos convites. Aguarde." }, { status: 429 });
  }

  // Validar body
  const parsed = await parseBody(req, inviteMemberSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { email, permissoes } = parsed.data;

  // Verifica se já existe membro com esse email para esse dono
  const { data: existing } = await supabaseAdmin
    .from("team_members")
    .select("id, status")
    .eq("owner_id", userId)
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Este e-mail já foi convidado" }, { status: 409 });
  }

  // Insere o membro como pendente antes de mandar o convite
  const { error: insertError } = await supabaseAdmin
    .from("team_members")
    .insert({ owner_id: userId, email, permissoes, status: "pendente" });

  if (insertError) {
    console.error("[invite-member] Insert erro:", insertError.message);
    return NextResponse.json({ error: "Erro ao cadastrar membro" }, { status: 500 });
  }

  // Manda convite via Supabase Auth (e-mail automático com link de cadastro)
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    data: { convidado_por: userId },
  });

  if (inviteError) {
    // Remove o registro se o convite falhou
    await supabaseAdmin.from("team_members").delete().eq("owner_id", userId).eq("email", email);
    console.error("[invite-member] Invite erro:", inviteError.message);
    return NextResponse.json({ error: "Erro ao enviar convite" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = await parseBody(req, deleteMemberSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("owner_id", userId);

  if (error) {
    console.error("[invite-member] Delete erro:", error.message);
    return NextResponse.json({ error: "Erro ao remover membro" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = await parseBody(req, updateMemberSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ permissoes: parsed.data.permissoes })
    .eq("id", parsed.data.memberId)
    .eq("owner_id", userId);

  if (error) {
    console.error("[invite-member] Patch erro:", error.message);
    return NextResponse.json({ error: "Erro ao atualizar permissões" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
