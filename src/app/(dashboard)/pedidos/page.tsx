"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList, Eye,
  ChevronRight, ChevronLeft, Loader2, RefreshCw,
  ArrowUpDown, ArrowUp, ArrowDown, MessageCircle,
  Pencil, Minus, Plus, X, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ORDER_STATUS, type OrderStatus } from "@/lib/status-colors";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type SortKey = "numero" | "customer_name" | "total" | "status" | "created_at";
type SortDir = "asc" | "desc";

interface OrderItemLocal {
  nome: string;
  qty: number;
  preco: number;
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
  novo: 0, confirmado: 1, em_preparo: 2, saiu_entrega: 3, entregue: 4, cancelado: 5,
};

function formatHora(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatItems(items: Order["items"]) {
  if (!items || !Array.isArray(items)) return "—";
  return items.map(i => `${i.qty}x ${i.nome}`).join(", ");
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<OrderStatus | "Todos">("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, numero, customer_id, status, total, subtotal, taxa_entrega, desconto, pagamento, endereco_entrega, criado_em, alterado_em,
        customers ( nome, telefone ),
        order_items ( nome, quantidade, preco_unit, observacao )
      `)
      .eq("user_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
    } else {
      const mapped: Order[] = (data || []).map((row: any) => ({
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
        items: (row.order_items || []).map((i: any) => ({ nome: i.nome, qty: i.quantidade, preco: i.preco_unit })),
        created_at: row.criado_em,
        alterado_em: row.alterado_em,
      }));
      setOrders(mapped);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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
    // Captura o status anterior ANTES do update otimista (pra detectar transicao)
    const oldStatus = orders.find(o => o.id === orderId)?.status;

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
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

  // Filter + Sort + Paginate
  const sortedFiltered = useMemo(() => {
    let list = filtroStatus === "Todos" ? [...orders] : orders.filter(o => o.status === filtroStatus);
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
  }, [orders, filtroStatus, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedFiltered.length / perPage);
  const paginated = sortedFiltered.slice((page - 1) * perPage, page * perPage);

  const contadores = Object.fromEntries(
    (["novo", "em_preparo", "saiu_entrega", "entregue", "cancelado"] as OrderStatus[])
      .map(s => [s, orders.filter(o => o.status === s).length])
  ) as Record<OrderStatus, number>;

  const allStatuses: OrderStatus[] = ["novo", "confirmado", "em_preparo", "saiu_entrega", "entregue", "cancelado"];

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
            <ClipboardList className="h-3.5 w-3.5" />{orders.length} pedidos
          </Badge>
        </div>
      </div>

      {/* Kanban compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {kanbanColumns.map(col => {
          const colOrders = orders.filter(o => o.status === col.key).slice(0, 5);
          const totalCol = orders.filter(o => o.status === col.key).length;
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
                  const isPix = order.payment_raw?.toLowerCase().includes("pix") && !!order.customer_phone;
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
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatHora(order.created_at)}</span>
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
                    {isPix && (
                      <div className="flex justify-end">
                        <Button asChild size="sm" variant="default" className="h-6 px-2 text-[11px] rounded-full">
                          <Link href={`/conversas?tel=${encodeURIComponent(order.customer_phone)}`}>
                            <MessageCircle className="h-3 w-3 mr-1" />
                            Conferir Pix
                          </Link>
                        </Button>
                      </div>
                    )}
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
            <span className="ml-2 text-sm font-normal text-muted-foreground">({sortedFiltered.length})</span>
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

        {/* Status filter pills */}
        <div className="px-6 pb-3 flex gap-1.5 flex-wrap">
          {(["Todos", "novo", "em_preparo", "saiu_entrega", "entregue", "cancelado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFiltroStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filtroStatus === s
                  ? "bg-primary text-white shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {s === "Todos" ? "Todos" : ORDER_STATUS[s]?.label}
              {s !== "Todos" && <span className="ml-1 opacity-70">({contadores[s] ?? 0})</span>}
            </button>
          ))}
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
                  <SortableHead label="Hora" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
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
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatHora(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <OrderDetailSheet order={order} onStatusChange={changeStatus} onOrderEdited={loadOrders} />
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
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, sortedFiltered.length)} de {sortedFiltered.length}
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

function OrderDetailSheet({ order, onStatusChange, onOrderEdited }: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onOrderEdited: () => void;
}) {
  const { user } = useAuth();
  const config = ORDER_STATUS[order.status];
  const allStatuses: OrderStatus[] = ["novo", "confirmado", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
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
        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
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
                <div className="space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.qty}x {item.nome}</span>
                      <span className="tabular-nums text-muted-foreground">R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span>
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
              <p className="text-xs font-medium text-muted-foreground mb-1">Hora</p>
              <p>{formatHora(order.created_at)}</p>
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
          {order.payment_raw?.toLowerCase().includes("pix") && order.customer_phone && (
            <>
              <Separator />
              <Button asChild variant="default" className="w-full">
                <Link href={`/conversas?tel=${encodeURIComponent(order.customer_phone)}`}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Conferir Pix
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
