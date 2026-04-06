import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com Service Role Key — para uso exclusivo em API routes server-side.
 * Bypassa RLS. Nunca expor no frontend.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extrai o user_id do token Bearer no header Authorization.
 */
export async function getAuthUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}
