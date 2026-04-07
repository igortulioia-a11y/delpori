import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

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
  const slug = searchParams.get("slug");

  if (!slug || slug.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
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
