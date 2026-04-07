"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingUp, PercentIcon, ShoppingBag, Loader2, Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const periodos = ["Hoje", "7 dias", "30 dias"];
const PIE_COLORS = ["#f97316", "#ef4444", "#8b5cf6", "#22c55e", "#06b6d4", "#eab308", "#ec4899", "#3b82f6"];

interface KPIs {
  receita: number;
  pedidos: number;
  ticketMedio: number;
  cancelados: number;
  totalOrders: number;
}

interface DailySummaryRow {
  data: string;
  pedidos: number;
  receita: number;
  ticketMedio: number;
}

interface ChartPoint {
  label: string;
  vendas: number;
  pedidos: number;
}

interface TopItem {
  name: string;
  count: number;
}

interface CategoryRevenue {
  name: string;
  value: number;
}

function getDaysBack(periodo: string) {
  if (periodo === "Hoje") return 1;
  if (periodo === "7 dias") return 7;
  return 30;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState("7 dias");
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState<KPIs>({ receita: 0, pedidos: 0, ticketMedio: 0, cancelados: 0, totalOrders: 0 });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummaryRow[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenue[]>([]);
  const [openConversations, setOpenConversations] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const days = getDaysBack(periodo);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Rodar todas as queries em paralelo
    const [ordersRes, summaryRes, productsRes, convsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, status, total, criado_em, order_items(nome, quantidade, preco_unit)")
        .eq("user_id", user.id)
        .gte("criado_em", sinceISO)
        .order("criado_em", { ascending: true })
        .limit(500),
      supabase
        .from("orders")
        .select("status, total, criado_em")
        .eq("user_id", user.id)
        .gte("criado_em", sevenDaysAgo.toISOString()),
      supabase
        .from("products")
        .select("nome, categoria")
        .eq("user_id", user.id),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["novo", "pendente"]),
    ]);

    const allOrders = ordersRes.data || [];
    const validOrders = allOrders.filter(o => o.status !== "cancelado");
    const canceledOrders = allOrders.filter(o => o.status === "cancelado");

    const totalReceita = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const ticketMedio = validOrders.length > 0 ? totalReceita / validOrders.length : 0;

    setKpis({
      receita: totalReceita,
      pedidos: validOrders.length,
      ticketMedio,
      cancelados: canceledOrders.length,
      totalOrders: allOrders.length,
    });

    // Build chart data grouped by day (or hour for "Hoje")
    const groupMap: Record<string, { vendas: number; pedidos: number }> = {};
    validOrders.forEach(o => {
      const date = new Date(o.criado_em);
      let label: string;
      if (periodo === "Hoje") {
        label = `${date.getHours().toString().padStart(2, "0")}h`;
      } else {
        label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      }
      if (!groupMap[label]) groupMap[label] = { vendas: 0, pedidos: 0 };
      groupMap[label].vendas += o.total || 0;
      groupMap[label].pedidos += 1;
    });
    const chart: ChartPoint[] = Object.entries(groupMap).map(([label, d]) => ({
      label,
      vendas: Math.round(d.vendas * 100) / 100,
      pedidos: d.pedidos,
    }));
    setChartData(chart);

    // Daily summary (last 7 days including hoje)
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    }

    const dayMap: Record<string, { pedidos: number; receita: number }> = {};
    last7Days.forEach(d => { dayMap[d] = { pedidos: 0, receita: 0 }; });

    (summaryRes.data || [])
      .filter(o => o.status !== "cancelado")
      .forEach(o => {
        const d = formatDate(o.criado_em);
        if (!dayMap[d]) dayMap[d] = { pedidos: 0, receita: 0 };
        dayMap[d].pedidos += 1;
        dayMap[d].receita += o.total || 0;
      });

    const summary: DailySummaryRow[] = last7Days.map(data => ({
      data,
      pedidos: dayMap[data]?.pedidos || 0,
      receita: Math.round((dayMap[data]?.receita || 0) * 100) / 100,
      ticketMedio: dayMap[data]?.pedidos > 0
        ? Math.round((dayMap[data].receita / dayMap[data].pedidos) * 100) / 100
        : 0,
    })).reverse();
    setDailySummary(summary);

    // Top items from order_items (joined)
    const itemCount: Record<string, number> = {};
    validOrders.forEach(o => {
      const items = (o as any).order_items;
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const nome = item.nome || "Item";
          itemCount[nome] = (itemCount[nome] || 0) + (item.quantidade || 1);
        });
      }
    });
    const top = Object.entries(itemCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopItems(top);

    // Category revenue
    const productCatMap: Record<string, string> = {};
    (productsRes.data || []).forEach((p: any) => {
      productCatMap[p.nome] = p.categoria || "Outros";
    });

    const catMap: Record<string, number> = {};
    validOrders.forEach(o => {
      const items = (o as any).order_items;
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const cat = productCatMap[item.nome] || "Outros";
          catMap[cat] = (catMap[cat] || 0) + ((item.preco_unit || 0) * (item.quantidade || 1));
        });
      }
    });
    if (Object.keys(catMap).length === 0 && totalReceita > 0) {
      catMap["Pedidos"] = totalReceita;
    }
    setCategoryRevenue(
      Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    );

    setOpenConversations(convsRes.count ?? 0);

    setLoading(false);
  }, [user?.id, periodo]);

  useEffect(() => { loadData(); }, [loadData]);

  const txCancelamento = kpis.totalOrders > 0
    ? ((kpis.cancelados / kpis.totalOrders) * 100).toFixed(1)
    : "0.0";

  const finKpis = [
    {
      label: periodo === "Hoje" ? "Receita do dia" : `Receita (${periodo})`,
      value: `R$ ${kpis.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    },
    {
      label: "Ticket médio",
      value: `R$ ${kpis.ticketMedio.toFixed(2).replace(".", ",")}`,
      icon: TrendingUp,
      iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400",
    },
    {
      label: "Taxa cancelamento",
      value: `${txCancelamento}%`,
      icon: PercentIcon,
      iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400",
    },
    {
      label: "Conversas abertas",
      value: openConversations.toString(),
      icon: ShoppingBag,
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    },
  ];

  const maxCount = topItems[0]?.count || 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
        </div>
        <div className="flex gap-1.5">
          {periodos.map(p => (
            <Button
              key={p}
              variant={periodo === p ? "default" : "outline"}
              size="sm"
              className={periodo === p
                ? "rounded-full bg-primary text-primary-foreground"
                : "rounded-full bg-card text-muted-foreground border"}
              onClick={() => setPeriodo(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {finKpis.map(kpi => (
          <Card key={kpi.label} className="shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">{kpi.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {periodo === "Hoje" ? "Vendas de hoje" : periodo === "7 dias" ? "Vendas da semana" : "Vendas do mês"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">
                Nenhum dado para este período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `R$${v / 1000}k` : `R$${v}`} />
                  <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Vendas"]} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }} />
                  <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Pedidos por período</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">
                Nenhum dado para este período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }} />
                  <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle row: Pie + Top items + Empty state hint */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Receita por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryRevenue.length === 0 ? (
              <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={categoryRevenue}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {categoryRevenue.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium"><Trophy className="h-4 w-4 inline mr-1.5 text-amber-500" /> Itens mais vendidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Sem pedidos no período
              </div>
            ) : (
              topItems.map((item, i) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-xs w-5">{i + 1}.</span>
                      {item.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground text-xs">{item.count} vendidos</span>
                  </div>
                  <Progress value={(item.count / maxCount) * 100} className="h-2" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Resumo do período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {[
              { label: "Total de pedidos", value: kpis.pedidos.toString() },
              { label: "Receita total", value: `R$ ${kpis.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
              { label: "Ticket médio", value: `R$ ${kpis.ticketMedio.toFixed(2).replace(".", ",")}` },
              { label: "Pedidos cancelados", value: kpis.cancelados.toString() },
              { label: "Conversas abertas", value: openConversations.toString() },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Daily summary table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Resumo diário (últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dailySummary.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum pedido nos últimos 7 dias
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailySummary.map(row => (
                  <TableRow key={row.data}>
                    <TableCell className="font-medium">{row.data}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {row.receita.toFixed(2).replace(".", ",")}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {row.ticketMedio.toFixed(2).replace(".", ",")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
