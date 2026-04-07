"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ORDER_STATUS, type OrderStatus } from "@/lib/status-colors";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type SortKey = "numero" | "customer_name" | "total" | "status" | "created_at";
type SortDir = "asc" | "desc";

interface Order {
  id: string;
  numero: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  total: number;
  payment_method: string;
  address: string;
  items: { nome: string; qty: number; preco: number }[];
  created_at: string;
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
        id, numero, customer_id, status, total, pagamento, endereco_entrega, criado_em,
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
        payment_method: row.pagamento ? (pagamentoLabel[row.pagamento] || row.pagamento) : "",
        address: row.endereco_entrega ?? "",
        items: (row.order_items || []).map((i: any) => ({ nome: i.nome, qty: i.quantidade, preco: i.preco_unit })),
        created_at: row.criado_em,
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
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, atualizado_em: new Date().toISOString() })
      .eq("id", orderId)
      .eq("user_id", user?.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      loadOrders();
    } else {
      toast({ title: "Status atualizado", description: `Pedido → ${ORDER_STATUS[newStatus]?.label}` });
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
                {colOrders.map(order => (
                  <div key={order.id} className="border rounded-lg px-3 py-2.5 flex items-center justify-between bg-card hover:shadow-sm transition-shadow">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm tabular-nums">#{order.numero}</span>
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
                        className="h-6 px-1.5 ml-2 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => changeStatus(order.id, nextStatus[order.status]!)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
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
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium text-sm">#{order.numero}</TableCell>
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
                        <OrderDetailSheet order={order} onStatusChange={changeStatus} />
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

function OrderDetailSheet({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, status: OrderStatus) => void }) {
  const config = ORDER_STATUS[order.status];
  const allStatuses: OrderStatus[] = ["novo", "confirmado", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Pedido #{order.numero}
            <Badge variant="outline" className={config.class}>{config.label}</Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Cliente</p>
            <p className="font-medium">{order.customer_name}</p>
            {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Itens</p>
            {order.items?.length > 0 ? (
              <div className="space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.qty}x {item.nome}</span>
                    <span className="tabular-nums text-muted-foreground">R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
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
