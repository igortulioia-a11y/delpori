import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserId } from "@/lib/supabase-admin";
import { parseBody, importMenuSchema, isValidExternalUrl } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/import-menu/import
 * Importa produtos selecionados: baixa imagens do UaiRango → upload Supabase Storage → insert products.
 * Body: { items: ImportMenuItem[], skipDuplicates: boolean }
 * Retorna: { imported, skipped, errors[] }
 */
export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Rate limit
  const rl = checkRateLimit(`import:${userId}`, RATE_LIMITS.importMenu);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitas importações. Aguarde." }, { status: 429 });
  }

  // Validar body com zod (inclui limite de 500 items)
  const parsed = await parseBody(req, importMenuSchema, 5 * 1024 * 1024);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { items, skipDuplicates } = parsed.data;

  // Buscar nomes existentes pra detectar duplicados
  let existingNames = new Set<string>();
  if (skipDuplicates) {
    const { data } = await supabaseAdmin
      .from("products")
      .select("nome")
      .eq("user_id", userId);
    existingNames = new Set((data ?? []).map((p) => p.nome.toLowerCase().trim()));
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    // Pular duplicados
    if (skipDuplicates && existingNames.has(item.nome.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    try {
      // Baixar e reupar imagem
      let imagemUrl: string | null = null;
      if (item.imagemUrl) {
        imagemUrl = await downloadAndUploadImage(item.imagemUrl, userId, imported);
      }

      // Inserir produto
      const { error: insertError } = await supabaseAdmin.from("products").insert({
        user_id: userId,
        nome: item.nome,
        descricao: item.descricao,
        preco: item.preco,
        categoria: item.categoria,
        imagem_url: imagemUrl,
        disponivel: true,
      });

      if (insertError) {
        console.error(`[import-menu] Insert erro para "${item.nome}":`, insertError.message);
        errors.push(`${item.nome}: falha ao importar`);
      } else {
        imported++;
      }
    } catch (err: any) {
      console.error(`[import-menu] Erro para "${item.nome}":`, err.message);
      errors.push(`${item.nome}: falha ao processar`);
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}

/**
 * Baixa imagem de URL externa e faz upload pro Supabase Storage.
 * Retorna a URL publica da imagem no Storage.
 */
async function downloadAndUploadImage(
  sourceUrl: string,
  userId: string,
  index: number
): Promise<string | null> {
  try {
    // Validar URL para prevenir SSRF
    if (!isValidExternalUrl(sourceUrl)) return null;

    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());

    // Limitar a 5MB (mesmo limite do frontend)
    if (buffer.length > 5 * 1024 * 1024) return null;

    const path = `${userId}/${Date.now()}-${index}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      console.error("[import-menu] Upload erro:", error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[import-menu] Download/upload erro:", err);
    return null;
  }
}
