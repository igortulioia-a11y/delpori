import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Detecta se localStorage esta disponivel (WebView do WhatsApp pode bloquear)
function isStorageAvailable(): boolean {
  try {
    const k = "__supabase_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = typeof window !== "undefined" && isStorageAvailable();

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    autoRefreshToken: storageAvailable,
    detectSessionInUrl: storageAvailable,
    // Desabilitar persistencia se storage nao disponivel (WebView restritivo)
    persistSession: storageAvailable,
    // Lock sem competicao: evita AbortError "Lock broken by another request with steal"
    lock: async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
      return fn();
    },
  },
});

// ─── Tipos das tabelas ────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  logo_url: string | null;
  plano: "free" | "pro" | "lifetime";
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  tipo_estabelecimento: string | null;
  slug: string | null;
  telefone_cozinha: string | null;
  descricao_estabelecimento: string | null;
}

export interface Product {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  categoria: string | null;
  imagem_url: string | null;
  disponivel: boolean;
  destaque: boolean;
  criado_em: string;
  category_id: string | null;
}

export interface Customer {
  id: string;
  user_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  endereco: string | null;
  total_pedidos: number;
  total_gasto: number;
  ultimo_pedido: string | null;
  tags: string[] | null;
  notas: string | null;
  criado_em: string;
  ultima_interacao: string | null;
  pedidos_count: number;
  is_novo: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  customer_id: string | null;
  numero: number;
  status: "novo" | "confirmado" | "em_preparo" | "saiu_entrega" | "entregue" | "cancelado";
  pagamento: "pix" | "credito" | "debito" | "dinheiro" | "vale_refeicao" | null;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  total: number;
  endereco_entrega: string | null;
  observacao: string | null;
  origem: string;
  criado_em: string;
  atualizado_em: string;
  cardapio_web: boolean;
  customers?: Customer;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  user_id: string;
  product_id: string | null;
  nome: string;
  quantidade: number;
  preco_unit: number;
  observacao: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  customer_id: string | null;
  whatsapp_id: string | null;
  cliente_nome: string;
  cliente_tel: string;
  status: "novo" | "pendente" | "resolvido";
  tags: string[] | null;
  ultima_mensagem: string | null;
  nao_lidas: number;
  atendida_por_ia: boolean;
  criado_em: string;
  atualizado_em: string;
  ai_paused: boolean;
  label: string | null;
  origem: string | null;
  last_msg_at: string | null;
  followup_count: number;
  followup_at: string | null;
  needs_followup: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  remetente: "cliente" | "atendente" | "ia";
  conteudo: string;
  whatsapp_msg_id: string | null;
  lida: boolean;
  criado_em: string;
}

export interface AutomationSettings {
  id: string;
  user_id: string;
  ativo: boolean;
  horario_ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  msg_fora_hora: string | null;
  evolution_instance: string | null;
  webhook_url: string | null;
  criado_em: string;
  atualizado_em: string;
  whatsapp_status: string | null;
  whatsapp_qr: string | null;
  whatsapp_phone: string | null;
  onboarding_done: boolean;
  ai_paused: boolean;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  taxa_entrega: number | null;
  area_entrega: string | null;
  tempo_entrega_min: number | null;
  followup_ativo: boolean;
  followup_delay_min: number | null;
  followup_max: number | null;
  followup_msg: string | null;
}

export interface Faq {
  id: string;
  user_id: string;
  pergunta: string;
  resposta: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
}

export interface DeliveryZone {
  id: string;
  user_id: string;
  nome: string;
  bairros: string[];
  taxa: number;
  tempo_estimado: number;
  ativo: boolean;
  criado_em: string;
}

export interface DailySpecial {
  id: string;
  user_id: string;
  dia_semana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  product_id: string;
  preco_promocional: number;
  ativo: boolean;
  criado_em: string;
}
