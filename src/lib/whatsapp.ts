import { supabaseAdmin } from "./supabase-admin";

interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Formata telefone para o padrão Evolution API: 55XXXXXXXXXXX
 */
function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11) digits = "55" + digits;
  if (digits.length === 10) digits = "55" + digits;
  return digits;
}

/**
 * Envia mensagem WhatsApp via Evolution API.
 * Busca credenciais automaticamente da tabela automation_settings.
 */
export async function sendWhatsApp(
  userId: string,
  telefone: string,
  mensagem: string
): Promise<SendResult> {
  const { data: config, error: configError } = await supabaseAdmin
    .from("automation_settings")
    .select("evolution_instance, evolution_api_url, evolution_api_key")
    .eq("user_id", userId)
    .single();

  if (configError || !config?.evolution_instance || !config?.evolution_api_url) {
    return { success: false, error: "WhatsApp não configurado" };
  }

  const number = formatPhone(telefone);

  const res = await fetch(
    `${config.evolution_api_url}/message/sendText/${config.evolution_instance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.evolution_api_key,
      },
      body: JSON.stringify({ number, text: mensagem }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    return { success: false, error: `Evolution API ${res.status}: ${errorText}` };
  }

  return { success: true };
}
