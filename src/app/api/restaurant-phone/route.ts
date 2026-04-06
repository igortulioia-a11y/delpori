import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Restaurante não encontrado" }, { status: 404 });
  }

  const { data: settings } = await supabaseAdmin
    .from("automation_settings")
    .select("whatsapp_phone, whatsapp_status, taxa_entrega")
    .eq("user_id", profile.id)
    .single();

  if (!settings?.whatsapp_phone || settings.whatsapp_status !== "conectado") {
    return NextResponse.json({ phone: null, taxa_entrega: null });
  }

  return NextResponse.json({
    phone: settings.whatsapp_phone,
    taxa_entrega: settings.taxa_entrega ? Number(settings.taxa_entrega) : null,
  });
}
