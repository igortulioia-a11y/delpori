import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserId } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { email, permissoes } = await req.json();
  if (!email) return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });

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
    .insert({ owner_id: userId, email, permissoes: permissoes ?? [], status: "pendente" });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Manda convite via Supabase Auth (e-mail automático com link de cadastro)
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    data: { convidado_por: userId },
  });

  if (inviteError) {
    // Remove o registro se o convite falhou
    await supabaseAdmin.from("team_members").delete().eq("owner_id", userId).eq("email", email);
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "ID do membro obrigatório" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("owner_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { memberId, permissoes } = await req.json();
  if (!memberId) return NextResponse.json({ error: "ID do membro obrigatório" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ permissoes })
    .eq("id", memberId)
    .eq("owner_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
