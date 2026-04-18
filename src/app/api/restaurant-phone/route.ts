import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeSlug } from "@/lib/utils";

export async function GET(request: Request) {
  // Rate limit por IP
  const ip = getClientIp(request);
  const rl = checkRateLimit(`restaurant-phone:${ip}`, RATE_LIMITS.restaurantPhone);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawSlug = searchParams.get("slug");

  if (!rawSlug || rawSlug.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(rawSlug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }

  const slug = normalizeSlug(rawSlug);

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
    .select("whatsapp_phone, whatsapp_status, taxa_entrega, formas_pagamento, horario_ativo, horario_inicio, horario_fim")
    .eq("user_id", profile.id)
    .single();

  const hours = {
    horario_ativo: settings?.horario_ativo ?? null,
    horario_inicio: settings?.horario_inicio ?? null,
    horario_fim: settings?.horario_fim ?? null,
  };

  if (!settings?.whatsapp_phone || settings.whatsapp_status !== "conectado") {
    return NextResponse.json({ phone: null, taxa_entrega: null, formas_pagamento: null, hours });
  }

  return NextResponse.json({
    phone: settings.whatsapp_phone,
    taxa_entrega: settings.taxa_entrega ? Number(settings.taxa_entrega) : null,
    formas_pagamento: settings.formas_pagamento || null,
    hours,
  });
}
