import { NextResponse } from "next/server";
import { supabaseAdmin, getAuthUserId } from "@/lib/supabase-admin";
import type { ImportMenuItem } from "@/lib/uairango";

/**
 * POST /api/import-menu/import
 * Importa produtos selecionados: baixa imagens do UaiRango → upload Supabase Storage → insert products.
 * Body: { items: ImportMenuItem[], skipDuplicates: boolean }
 * Retorna: { imported, skipped, errors[] }
 */
export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { items, skipDuplicates = true } = (await req.json()) as {
    items: ImportMenuItem[];
    skipDuplicates: boolean;
  };

  if (!items?.length) {
    return NextResponse.json({ error: "Nenhum item para importar" }, { status: 400 });
  }

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
        errors.push(`${item.nome}: ${insertError.message}`);
      } else {
        imported++;
      }
    } catch (err: any) {
      errors.push(`${item.nome}: ${err.message}`);
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
    const res = await fetch(sourceUrl);
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
