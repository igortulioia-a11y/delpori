"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  ClipboardList, Eye,
  ChevronRight, ChevronLeft, Loader2, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown, MessageCircle,
  Pencil, Minus, Plus, X, Save, Printer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ORDER_STATUS, type OrderStatus } from "@/lib/status-colors";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { printOrder, type RestauranteForPrint } from "@/lib/print-order";

type SortKey = "numero" | "customer_name" | "total" | "status" | "created_at";
type SortDir = "asc" | "desc";

interface OrderItemLocal {
  nome: string;
  qty: number;
  preco: number;
  obs?: string;
}

interface Order {
  id: string;
  numero: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  payment_method: string;
  payment_raw: string;
  address: string;
  items: OrderItemLocal[];
  created_at: string;
  alterado_em: string | null;
}

interface ProductOption {
  id: string;
  nome: string;
  preco: number;
  categoria: string | null;
}

const kanbanColumns: { key: OrderStatus; label: string }[] = [
  { key: "novo",         label: "Novos" },
  { key: "em_preparo",   label: "Em preparo" },
  { key: "saiu_entrega", label: "A caminho" },
];

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  novo:         "em_preparo",
  em_preparo:   "saiu_entrega",
  saiu_entrega: "entregue",
};

const pagamentoLabel: Record<string, string> = {
  pix: "PIX", credito: "Cartão de crédito", debito: "Cartão de débito",
  dinheiro: "Dinheiro", vale_refeicao: "Vale-refeição",
};

const statusOrder: Record<OrderStatus, number> = {
  novo: 0, em_preparo: 1, saiu_entrega: 2, entregue: 3, cancelado: 4,
};

// Smart display: "10:42" se hoje, "Ontem 10:42" se ontem,
// "14/04 10:42" se este ano, "14/04/25 10:42" se ano passado.
function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dDay.getTime() === today.getTime()) return hora;
  if (dDay.getTime() === yesterday.getTime()) return `Ontem ${hora}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hora}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)} ${hora}`;
}

// Data completa pro sheet de detalhes: "14/04/2026 • 10:42"
function formatOrderDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const data = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} • ${hora}`;
}

// Calcula range de datas para o filtro (inicio/fim em ISO).
// "tudo" retorna from vazio (sem filtro de data).
type DateFilter = "hoje" | "ontem" | "7d" | "30d" | "tudo";
function getDateRange(filter: DateFilter): { fromISO?: string; toISO?: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "tudo") return {};
  if (filter === "hoje") {
    return { fromISO: startOfToday.toISOString() };
  }
  if (filter === "ontem") {
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    return { fromISO: startOfYesterday.toISOString(), toISO: startOfToday.toISOString() };
  }
  if (filter === "7d") {
    const d = new Date(startOfToday.getTime() - 6 * 86400000); // inclui hoje
    return { fromISO: d.toISOString() };
  }
  if (filter === "30d") {
    const d = new Date(startOfToday.getTime() - 29 * 86400000);
    return { fromISO: d.toISOString() };
  }
  return {};
}

function formatItems(items: Order["items"]) {
  if (!items || !Array.isArray(items)) return "—";
  return items.map(i => {
    const obsText = i.obs ? ` (${i.obs})` : "";
    return `${i.qty}x ${i.nome}${obsText}`;
  }).join(", ");
}

// ─── Sortable Header ────────────────────────────────────────────────────────

function SortableHead({ label, sortKey, currentSort, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir;
  onSort: (key: SortKey) => void; className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {active ? (
          currentDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);          // pagina atual da tabela
  const [kanbanOrders, setKanbanOrders] = useState<Order[]>([]); // pedidos ativos (kanban)
  const [totalCount, setTotalCount] = useState(0);              // total de pedidos do filtro atual (server)
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<OrderStatus | "Todos">("Todos");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoje");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [restaurante, setRestaurante] = useState<RestauranteForPrint>({ nome: "Delpori" });

  const mapOrderRow = (row: any): Order => ({
    id: row.id,
    numero: row.numero ?? 0,
    customer_id: row.customer_id,
    customer_name: row.customers?.nome ?? "Cliente",
    customer_phone: row.customers?.telefone ?? "",
    status: row.status as OrderStatus,
    total: row.total ?? 0,
    subtotal: row.subtotal ?? 0,
    taxa_entrega: row.taxa_entrega ?? 0,
    desconto: row.desconto ?? 0,
    payment_method: row.pagamento ? (pagamentoLabel[row.pagamento] || row.pagamento) : "",
    payment_raw: row.pagamento || "",
    address: row.endereco_entrega ?? "",
    items: (row.order_items || []).map((i: any) => ({ nome: i.nome, qty: i.quantidade, preco: i.preco_unit, obs: i.observacao || "" })),
    created_at: row.criado_em,
    alterado_em: row.alterado_em,
  });

  // Carrega pedidos ativos pro kanban (novo, em_preparo, saiu_entrega).
  // Nao filtra por data nem pagina — kanban e operacao real-time.
  const loadKanbanOrders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, numero, customer_id, status, total, subtotal, taxa_entrega, desconto, pagamento, endereco_entrega, criado_em, alterado_em,
        customers ( nome, telefone ),
        order_items ( nome, quantidade, preco_unit, observacao )
      `)
      .eq("user_id", user.id)
      .in("status", ["novo", "em_preparo", "saiu_entrega"])
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Erro ao carregar kanban", description: error.message, variant: "destructive" });
      return;
    }
    setKanbanOrders((data || []).map(mapOrderRow));
  }, [user?.id]);

  // Carrega a pagina atual da tabela com filtros de data + status + paginacao server-side.
  const loadTableOrders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { fromISO, toISO } = getDateRange(dateFilter);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from("orders")
      .select(`
        id, numero, customer_id, status, total, subtotal, taxa_entrega, desconto, pagamento, endereco_entrega, criado_em, alterado_em,
        customers ( nome, telefone ),
        order_items ( nome, quantidade, preco_unit, observacao )
      `, { count: "exact" })
      .eq("user_id", user.id);

    if (fromISO) query = query.gte("criado_em", fromISO);
    if (toISO) query = query.lt("criado_em", toISO);
    if (filtroStatus !== "Todos") query = query.eq("status", filtroStatus);

    const { data, error, count } = await query
      .order("criado_em", { ascending: false })
      .range(from, to);

    if (error) {
      toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
    } else {
      setOrders((data || []).map(mapOrderRow));
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [user?.id, dateFilter, filtroStatus, page, perPage]);

  // Refetch quando muda filtros/pagina (tabela)
  useEffect(() => { loadTableOrders(); }, [loadTableOrders]);

  // Kanban: roda 1x no mount
  useEffect(() => { loadKanbanOrders(); }, [loadKanbanOrders]);

  // Refetch combinado (usado quando o pedido e editado/criado/mudou status)
  const loadOrders = useCallback(async () => {
    await Promise.all([loadKanbanOrders(), loadTableOrders()]);
  }, [loadKanbanOrders, loadTableOrders]);

  // Carrega dados do restaurante (nome + telefone) pra impressao
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome, telefone_cozinha")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setRestaurante({
            nome: data.nome || "Delpori",
            telefone: data.telefone_cozinha,
          });
        }
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => { loadOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const changeStatus = async (orderId: string, newStatus: OrderStatus) => {
    // Captura o status anterior e o pedido ANTES do update otimista
    // (busca em orders OU kanbanOrders porque o pedido pode estar em um ou outro)
    const currentOrder = orders.find(o => o.id === orderId) || kanbanOrders.find(o => o.id === orderId);
    const oldStatus = currentOrder?.status;

    // Update otimista nos dois states
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    const isKanbanStatus = (s: OrderStatus) => s === "novo" || s === "em_preparo" || s === "saiu_entrega";
    setKanbanOrders(prev => {
      // Se o novo status sai do kanban, remove
      if (!isKanbanStatus(newStatus)) {
        return prev.filter(o => o.id !== orderId);
      }
      // Se ja existia no kanban, atualiza. Senao adiciona (vindo de fora do kanban).
      const existing = prev.find(o => o.id === orderId);
      if (existing) {
        return prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      }
      if (currentOrder) {
        return [{ ...currentOrder, status: newStatus }, ...prev];
      }
      return prev;
    });

    // Auto-print ao passar pra "em_preparo" (primeira vez). Chamado SINCRONAMENTE
    // antes do await pra manter o user-gesture context e evitar popup blocker.
    if (currentOrder && newStatus === "em_preparo" && oldStatus !== "em_preparo") {
      const ok = printOrder(currentOrder, restaurante);
      if (!ok) {
        toast({
          title: "Popup bloqueado",
          description: "Habilite popups no navegador pra impressao automatica funcionar.",
          variant: "destructive",
        });
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
      .eq("id", orderId)
      .eq("user_id", user?.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      loadOrders();
      return;
    }

    toast({ title: "Status atualizado", description: `Pedido → ${ORDER_STATUS[newStatus]?.label}` });

    // Notifica o cliente via WhatsApp nas transicoes relevantes (fire-and-forget):
    // - em_preparo → saiu_entrega: "Seu pedido saiu para entrega"
    // - qualquer → cancelado: "Seu pedido foi cancelado"
    const shouldNotify =
      (oldStatus === "em_preparo" && newStatus === "saiu_entrega") ||
      (newStatus === "cancelado" && oldStatus !== "cancelado");

    if (shouldNotify) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Nao aguarda: a UI ja deu feedback via toast, nao bloqueia
          fetch("/api/notify-order-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId }),
          }).catch(err => console.error("Erro ao notificar cliente:", err));
        }
      } catch (err) {
        console.error("Erro ao preparar notificacao ao cliente:", err);
      }
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" || key === "numero" ? "desc" : "asc");
    }
    setPage(1);
  };

  // Sort client-side sobre a pagina atual (orders ja vem filtrada/paginada do server)
  const paginated = useMemo(() => {
    const list = [...orders];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "numero": cmp = a.numero - b.numero; break;
        case "customer_name": cmp = a.customer_name.localeCompare(b.customer_name); break;
        case "total": cmp = a.total - b.total; break;
        case "status": cmp = statusOrder[a.status] - statusOrder[b.status]; break;
        case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const allStatuses: OrderStatus[] = ["novo", "em_preparo", "saiu_entrega", "entregue", "cancelado"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os pedidos do seu delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadOrders}><RefreshCw className="h-4 w-4" /></Button>
          <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1.5">
            <ClipboardList className="h-3.5 w-3.5" />{totalCount} pedidos
          </Badge>
        </div>
      </div>

      {/* Kanban compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {kanbanColumns.map(col => {
          const colOrders = kanbanOrders.filter(o => o.status === col.key).slice(0, 5);
          const totalCol = kanbanOrders.filter(o => o.status === col.key).length;
          const config = ORDER_STATUS[col.key];
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.class}>
                  <config.icon className="h-3 w-3 mr-1" />{col.label}
                </Badge>
                <span className="text-sm text-muted-foreground">({totalCol})</span>
              </div>
              <div className="space-y-1.5">
                {colOrders.length === 0 && (
                  <div className="border border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground">Nenhum pedido</div>
                )}
                {colOrders.map(order => {
                  const isAltered = !!order.alterado_em && !["entregue", "cancelado"].includes(order.status);
                  return (
                  <div key={order.id} className="border rounded-lg px-3 py-2.5 bg-card hover:shadow-sm transition-shadow space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm tabular-nums">#{order.numero}</span>
                          {isAltered && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-400">
                              Alterado
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground truncate">{order.customer_name}</span>
                          <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">{formatOrderDate(order.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">{formatItems(order.items)}</span>
                          <span className="text-sm font-bold tabular-nums ml-2 shrink-0">R$ {order.total.toFixed(2).replace(".", ",")}</span>
                        </div>
                      </div>
                      {nextStatus[order.status] && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 px-1.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => changeStatus(order.id, nextStatus[order.status]!)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-start gap-1.5">
                      <OrderDetailSheet
                        order={order}
                        onStatusChange={changeStatus}
                        onOrderEdited={loadOrders}
                        restaurante={restaurante}
                        trigger={
                          <Button size="sm" variant="outline" className="h-6 px-2.5 text-[11px] rounded-full">
                            <Eye className="h-3 w-3 mr-1" />
                            Abrir
                          </Button>
                        }
                      />
                      {order.customer_phone && (
                        <Button asChild size="sm" variant="outline" className="h-6 px-2.5 text-[11px] rounded-full">
                          <Link href={`/conversas?tel=${encodeURIComponent(order.customer_phone)}`}>
                            <MessageCircle className="h-3 w-3 mr-1" />
                            Conversa
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}
                {totalCol > 5 && (
                  <button
                    onClick={() => { setFiltroStatus(col.key); setPage(1); }}
                    className="w-full text-center text-xs text-muted-foreground hover:text-primary py-1 transition-colors"
                  >
                    Ver todos ({totalCol})
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela com ordenação e paginação */}
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base">
            {filtroStatus === "Todos" ? "Todos os pedidos" : `Pedidos — ${ORDER_STATUS[filtroStatus as OrderStatus]?.label}`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({totalCount})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Por página:</span>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 30, 50, 100].map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* Filtros: data + status em dropdowns lado a lado */}
        <div className="px-6 pb-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Período:</span>
            <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setPage(1); }}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="tudo">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v as OrderStatus | "Todos"); setPage(1); }}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="novo">{ORDER_STATUS.novo.label}</SelectItem>
                <SelectItem value="em_preparo">{ORDER_STATUS.em_preparo.label}</SelectItem>
                <SelectItem value="saiu_entrega">{ORDER_STATUS.saiu_entrega.label}</SelectItem>
                <SelectItem value="entregue">{ORDER_STATUS.entregue.label}</SelectItem>
                <SelectItem value="cancelado">{ORDER_STATUS.cancelado.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Pedido" sortKey="numero" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHead label="Cliente" sortKey="customer_name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <TableHead className="hidden md:table-cell">Itens</TableHead>
                  <SortableHead label="Valor" sortKey="total" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHead label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHead label="Data" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order) => {
                  const config = ORDER_STATUS[order.status];
                  const isAltered = !!order.alterado_em && !["entregue", "cancelado"].includes(order.status);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          <span>#{order.numero}</span>
                          {isAltered && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-400">
                              Alterado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.customer_name}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-sm text-muted-foreground">
                        {formatItems(order.items)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">R$ {order.total.toFixed(2).replace(".", ",")}</TableCell>
                      <TableCell>
                        <Select value={order.status} onValueChange={(v) => changeStatus(order.id, v as OrderStatus)}>
                          <SelectTrigger className="h-7 w-[110px] sm:w-[130px] text-xs border-0 p-0 px-1">
                            <Badge variant="outline" className={`${config.class} pointer-events-none text-xs`}>
                              {config.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {allStatuses.map(s => (
                              <SelectItem key={s} value={s}>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS[s].class}`}>
                                  {ORDER_STATUS[s].label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground tabular-nums">
                        {formatOrderDate(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <OrderDetailSheet order={order} onStatusChange={changeStatus} onOrderEdited={loadOrders} restaurante={restaurante} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalCount)} de {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <Button
                      key={p} variant={page === p ? "default" : "ghost"}
                      size="icon" className="h-7 w-7 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderDetailSheet({ order, onStatusChange, onOrderEdited, restaurante, trigger }: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onOrderEdited: () => void;
  restaurante: RestauranteForPrint;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const config = ORDER_STATUS[order.status];
  const allStatuses: OrderStatus[] = ["novo", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<OrderItemLocal[]>(order.items);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const canEdit = !["entregue", "cancelado"].includes(order.status);

  // Recarrega items originais quando o sheet abre/fecha ou quando o pedido muda
  useEffect(() => {
    if (!editMode) {
      setEditItems(order.items);
    }
  }, [order.items, editMode]);

  // Fecha o edit mode quando o sheet fecha
  useEffect(() => {
    if (!sheetOpen) {
      setEditMode(false);
      setEditItems(order.items);
    }
  }, [sheetOpen, order.items]);

  // Carrega produtos disponiveis ao entrar no edit mode
  useEffect(() => {
    if (!editMode || !user || products.length > 0) return;
    setLoadingProducts(true);
    supabase
      .from("products")
      .select("id, nome, preco, categoria, disponivel")
      .eq("user_id", user.id)
      .eq("disponivel", true)
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        setProducts((data || []) as ProductOption[]);
        setLoadingProducts(false);
      });
  }, [editMode, user, products.length]);

  const editSubtotal = useMemo(
    () => editItems.reduce((sum, it) => sum + it.preco * it.qty, 0),
    [editItems]
  );
  const editTotal = useMemo(
    () => editSubtotal + (order.taxa_entrega ?? 0) - (order.desconto ?? 0),
    [editSubtotal, order.taxa_entrega, order.desconto]
  );

  const incQty = (i: number) =>
    setEditItems(items => items.map((it, idx) => idx === i ? { ...it, qty: it.qty + 1 } : it));
  const decQty = (i: number) =>
    setEditItems(items => items.map((it, idx) => idx === i && it.qty > 1 ? { ...it, qty: it.qty - 1 } : it));
  const removeItem = (i: number) =>
    setEditItems(items => items.filter((_, idx) => idx !== i));

  const addItem = (productId: string) => {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    const existing = editItems.findIndex(it => it.nome === p.nome);
    if (existing !== -1) {
      incQty(existing);
    } else {
      setEditItems(items => [...items, { nome: p.nome, qty: 1, preco: Number(p.preco) }]);
    }
  };

  const cancelEdit = () => {
    setEditItems(order.items);
    setEditMode(false);
  };

  const saveChanges = async () => {
    if (!user) return;
    if (editItems.length === 0) {
      toast({ title: "Adicione pelo menos um item", variant: "destructive" });
      return;
    }
    setSavingEdit(true);

    // 1. DELETE todos os items antigos
    const { error: delErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", order.id)
      .eq("user_id", user.id);

    if (delErr) {
      toast({ title: "Erro ao salvar", description: delErr.message, variant: "destructive" });
      setSavingEdit(false);
      return;
    }

    // 2. INSERT novos items
    const { error: insErr } = await supabase
      .from("order_items")
      .insert(editItems.map(it => ({
        order_id: order.id,
        user_id: user.id,
        nome: it.nome,
        quantidade: it.qty,
        preco_unit: it.preco,
        observacao: it.obs || null,
      })));

    if (insErr) {
      toast({ title: "Erro ao salvar", description: insErr.message, variant: "destructive" });
      setSavingEdit(false);
      return;
    }

    // 3. UPDATE order (subtotal + total + alterado_em)
    const { error: updErr } = await supabase
      .from("orders")
      .update({
        subtotal: editSubtotal,
        total: editTotal,
        alterado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("user_id", user.id);

    if (updErr) {
      toast({ title: "Erro ao salvar", description: updErr.message, variant: "destructive" });
      setSavingEdit(false);
      return;
    }

    toast({
      title: "Pedido atualizado!",
      description: `Novo total: R$ ${editTotal.toFixed(2).replace(".", ",")}`,
    });

    // 4. Fire-and-forget: notifica cozinha
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch("/api/notify-kitchen", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId: order.id }),
        }).catch(err => console.error("Erro notify-kitchen:", err));
      }
    } catch (err) {
      console.error("Erro ao preparar notify-kitchen:", err);
    }

    setEditMode(false);
    setSavingEdit(false);
    onOrderEdited();
  };

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        {trigger ?? <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Pedido #{order.numero}
            <Badge variant="outline" className={config.class}>{config.label}</Badge>
            {order.alterado_em && !["entregue", "cancelado"].includes(order.status) && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-400">
                Alterado
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => printOrder(order, restaurante)}
          >
            <Printer className="h-4 w-4" />
            Imprimir cupom
          </Button>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Cliente</p>
            <p className="font-medium">{order.customer_name}</p>
            {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
          </div>
          <Separator />

          {/* Itens — view mode ou edit mode */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Itens</p>
              {!editMode && canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditMode(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              )}
            </div>

            {!editMode ? (
              // VIEW MODE
              order.items?.length > 0 ? (
                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div>{item.qty}x {item.nome}</div>
                        {item.obs && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 italic mt-0.5">Obs: {item.obs}</div>
                        )}
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0">R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">—</p>
            ) : (
              // EDIT MODE
              <div className="space-y-2">
                {editItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary/40 rounded-lg p-2">
                    <span className="flex-1 text-sm truncate">{item.nome}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => decQty(i)}
                        disabled={item.qty <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium tabular-nums">{item.qty}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => incQty(i)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="w-20 text-right text-sm tabular-nums shrink-0">
                      R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => removeItem(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {editItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum item. Adicione abaixo.</p>
                )}

                {/* Adicionar novo item */}
                <Select value="" onValueChange={addItem}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={loadingProducts ? "Carregando produtos..." : "+ Adicionar item do cardápio"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 && !loadingProducts && (
                      <div className="text-xs text-muted-foreground px-2 py-1">Nenhum produto disponível</div>
                    )}
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — R$ {Number(p.preco).toFixed(2).replace(".", ",")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Preview do novo total */}
                <div className="flex justify-between items-center pt-2 border-t text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="tabular-nums">R$ {editSubtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {order.taxa_entrega > 0 && (
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>+ Taxa de entrega:</span>
                    <span className="tabular-nums">R$ {order.taxa_entrega.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                {order.desconto > 0 && (
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>− Desconto:</span>
                    <span className="tabular-nums">R$ {order.desconto.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t font-semibold text-sm">
                  <span>Novo total:</span>
                  <span className="tabular-nums text-base">R$ {editTotal.toFixed(2).replace(".", ",")}</span>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={cancelEdit}
                    disabled={savingEdit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={saveChanges}
                    disabled={savingEdit || editItems.length === 0}
                  >
                    {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {savingEdit ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Total</p>
              <p className="text-lg font-bold tabular-nums">R$ {order.total.toFixed(2).replace(".", ",")}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Data</p>
              <p className="text-sm tabular-nums">{formatOrderDateTime(order.created_at)}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Endereço</p>
            <p className="text-sm">{order.address || "—"}</p>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Pagamento</p>
            <p className="text-sm">{order.payment_method || "—"}</p>
          </div>
          {order.customer_phone && (
            <>
              <Separator />
              <Button asChild variant="outline" className="w-full">
                <Link href={`/conversas?tel=${encodeURIComponent(order.customer_phone)}`}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir conversa
                </Link>
              </Button>
            </>
          )}
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Atualizar status</p>
            <Select value={order.status} onValueChange={(v) => onStatusChange(order.id, v as OrderStatus)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allStatuses.map(s => (
                  <SelectItem key={s} value={s}>{ORDER_STATUS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
