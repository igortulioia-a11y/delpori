"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Send, Tag, Plus, X, UtensilsCrossed, Loader2, RefreshCw,
  Bot, UserRound, Phone, ExternalLink, ShoppingBag, MessageCircle,
  Clock, MapPin, Calendar, Sparkles, ChevronRight, PanelRightOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConversationStatus = "novo" | "pendente" | "resolvido";

interface ConversationRow {
  id: string;
  customer_id: string | null;
  cliente_nome: string;
  cliente_tel: string;
  status: ConversationStatus;
  tags: string[];
  ai_paused: boolean;
  atualizado_em: string;
  criado_em: string;
  nao_lidas: number;
  origem: string | null;
  customers: {
    nome: string;
    telefone: string;
    endereco: string | null;
    total_pedidos: number;
    total_gasto: number;
    ultimo_pedido: string | null;
    pedidos_count: number;
    notas: string | null;
  } | null;
  lastMessage?: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  remetente: "cliente" | "atendente" | "ia";
  conteudo: string;
  criado_em: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────


const avatarColors = [
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function renderWhatsAppText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.startsWith("_") && part.endsWith("_"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("~") && part.endsWith("~"))
      return <del key={i}>{part.slice(1, -1)}</del>;
    return part;
  });
}

function formatDateGroup(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatPhone(tel: string) {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return tel;
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function groupMessagesByDate(messages: MessageRow[]) {
  const groups: { label: string; messages: MessageRow[] }[] = [];
  let currentLabel = "";
  for (const msg of messages) {
    const label = formatDateGroup(msg.criado_em);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

function getConversationDateGroups(conversations: ConversationRow[]) {
  const groups: { label: string; conversations: ConversationRow[] }[] = [];
  let currentLabel = "";
  for (const conv of conversations) {
    const label = formatDateGroup(conv.atualizado_em);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, conversations: [conv] });
    } else {
      groups[groups.length - 1].conversations.push(conv);
    }
  }
  return groups;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Conversations() {
  const { user, session, profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"todos" | "humano" | "ia">("todos");
  const [msgInput, setMsgInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSelected = useRef(false);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!user) { setLoadingConvs(false); return; }
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id, customer_id, cliente_nome, cliente_tel, status, tags, ai_paused, atualizado_em, ultima_mensagem, nao_lidas, origem, criado_em,
        customers ( nome, telefone, endereco, total_pedidos, total_gasto, ultimo_pedido, pedidos_count, notas )
      `)
      .eq("user_id", user.id)
      .order("atualizado_em", { ascending: false })
      .limit(50);

    if (error) {
      // Ignorar erros de lock transientes do Supabase Auth (se resolvem sozinhos)
      if (!error.message?.includes("Lock") && !error.message?.includes("lock")) {
        toast({ title: "Erro ao carregar conversas", description: error.message, variant: "destructive" });
      }
    } else {
      const mapped: ConversationRow[] = (data || []).map((row: any) => ({
        id: row.id,
        customer_id: row.customer_id,
        cliente_nome: row.cliente_nome || "",
        cliente_tel: row.cliente_tel || "",
        status: row.status as ConversationStatus,
        tags: Array.isArray(row.tags) ? row.tags : [],
        ai_paused: row.ai_paused ?? false,
        atualizado_em: row.atualizado_em,
        criado_em: row.criado_em,
        nao_lidas: row.nao_lidas ?? 0,
        origem: row.origem,
        customers: row.customers,
        lastMessage: row.ultima_mensagem || "Sem mensagens",
      }));
      setConversations(mapped);
      if (!hasAutoSelected.current && mapped.length > 0) {
        setSelectedId(mapped[0].id);
        hasAutoSelected.current = true;
      }
    }
    setLoadingConvs(false);
  }, [user?.id]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("criado_em", { ascending: false })
      .limit(100);
    // Reverter para ordem cronologica apos limitar
    if (data) data.reverse();

    if (!error) {
      setMessages(data || []);
      // Marcar mensagens como lidas e resetar contador na conversa
      supabase
        .from("messages")
        .update({ lida: true })
        .eq("conversation_id", convId)
        .eq("lida", false)
        .then(() => {});
      supabase
        .from("conversations")
        .update({ nao_lidas: 0 })
        .eq("id", convId)
        .then(() => {});
      // Atualizar estado local imediatamente
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, nao_lidas: 0 } : c));
    }
    setLoadingMsgs(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Real-time: new messages
  useEffect(() => {
    if (!selectedId) return;
    let stale = false;
    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        if (stale) return;
        setMessages(prev => {
          const exists = prev.some(m => m.id === (payload.new as MessageRow).id);
          if (exists) return prev;
          return [...prev, payload.new as MessageRow];
        });
      })
      .subscribe();
    return () => { stale = true; supabase.removeChannel(channel); };
  }, [selectedId]);

  // Real-time: conversation list (trigger atualiza conversations automaticamente em cada nova mensagem)
  useEffect(() => {
    if (!user) return;
    let stale = false;
    const channel = supabase
      .channel(`conversations-list-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${user.id}`,
      }, () => { if (!stale) loadConversations(); })
      .subscribe();
    return () => { stale = true; supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ─── Derived State ─────────────────────────────────────────────────────────

  const filtered = conversations.filter((c) => {
    const nome = c.customers?.nome || c.cliente_nome || "";
    const matchSearch = nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.lastMessage ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === "todos"
      || (activeFilter === "humano" && c.ai_paused)
      || (activeFilter === "ia" && !c.ai_paused);
    return matchSearch && matchFilter;
  });

  const selected = conversations.find((c) => c.id === selectedId);
  const messageGroups = groupMessagesByDate(messages);
  const conversationGroups = getConversationDateGroups(filtered);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!msgInput.trim() || !selectedId || !user) {
      console.warn("[sendMessage] early return:", { hasInput: !!msgInput.trim(), selectedId, userId: user?.id });
      return;
    }
    setSending(true);
    const text = msgInput.trim();
    setMsgInput("");

    // Optimistic update: mostra a mensagem imediatamente na UI
    const optimisticMsg: MessageRow = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedId,
      remetente: "atendente",
      conteudo: text,
      criado_em: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data: inserted, error } = await supabase.from("messages").insert({
      conversation_id: selectedId,
      remetente: "atendente",
      conteudo: text,
      user_id: user.id,
    }).select("id, conversation_id, remetente, conteudo, criado_em").single();

    if (error) {
      console.error("[sendMessage] insert error:", error);
      toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setMsgInput(text);
      setSending(false);
      return;
    }

    // Substituir mensagem otimista pela real (com ID do banco)
    if (inserted) {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? inserted : m));
    }

    const telefone = selected?.cliente_tel;
    if (telefone) {
      fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ telefone, mensagem: text }),
      }).catch((err) => {
        console.error("[sendMessage] WhatsApp send error:", err);
        toast({ title: "Mensagem salva, mas falha ao enviar via WhatsApp", variant: "destructive" });
      });
    }

    await supabase.from("conversations")
      .update({ atualizado_em: new Date().toISOString(), ai_paused: true })
      .eq("id", selectedId);

    setConversations(prev => prev.map(c =>
      c.id === selectedId
        ? { ...c, ai_paused: true, lastMessage: text, atualizado_em: new Date().toISOString() }
        : c
    ));

    setSending(false);
  };


  const addTag = async () => {
    if (!tagInput.trim() || !selectedId || !selected) return;
    const newTags = [...selected.tags, tagInput.trim()];
    const { error } = await supabase
      .from("conversations")
      .update({ tags: newTags })
      .eq("id", selectedId);
    if (!error) {
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, tags: newTags } : c));
    }
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    if (!selectedId || !selected) return;
    const newTags = selected.tags.filter(e => e !== tag);
    const { error } = await supabase
      .from("conversations")
      .update({ tags: newTags })
      .eq("id", selectedId);
    if (!error) {
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, tags: newTags } : c));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendCardapio = async () => {
    if (!user || !selectedId || !profile?.slug) return;
    const menuUrl = `${window.location.origin}/cardapio/${profile.slug}`;
    const text = `📋 Acesse nosso cardápio e faça seu pedido:\n${menuUrl}`;
    await supabase.from("messages").insert({
      conversation_id: selectedId,
      remetente: "atendente",
      conteudo: text,
      user_id: user.id,
    });
    const telefone = selected?.cliente_tel;
    if (telefone) {
      fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ telefone, mensagem: text }),
      }).catch(() => {});
    }
  };

  const resumeAi = async () => {
    if (!selected) return;
    await supabase.from("conversations").update({ ai_paused: false }).eq("id", selected.id);
    setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, ai_paused: false } : c));
    toast({ title: "IA retomada nesta conversa" });
  };

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loadingConvs) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="w-80 border-r p-3 space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-7 w-16 rounded-full" />)}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  // ─── Empty State ───────────────────────────────────────────────────────────

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] text-center px-6">
        <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mb-6">
          <MessageCircle className="h-10 w-10 text-orange-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Nenhuma conversa ainda</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          As conversas do WhatsApp aparecerão aqui automaticamente quando seus clientes enviarem mensagens.
        </p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">

      {/* ═══ LEFT PANEL — Conversation List ═══ */}
      <div className="w-96 border-r flex flex-col shrink-0 bg-card">
        {/* Search + Refresh */}
        <div className="p-3 pb-0">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                className="pl-9 h-9 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-orange-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" onClick={loadConversations}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-2.5 flex gap-1.5 flex-wrap">
          {([
            { key: "todos", label: "Todos", icon: null },
            { key: "humano", label: "Humano", icon: <UserRound className="h-3 w-3" /> },
            { key: "ia", label: "IA", icon: <Sparkles className="h-3 w-3" /> },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                activeFilter === f.key
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {f.icon}{f.label}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {conversationGroups.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
          )}
          {conversationGroups.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-1.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
              </div>
              {group.conversations.map((c) => {
                const nome = c.customers?.nome || c.cliente_nome || "Desconhecido";
                const color = getAvatarColor(nome);
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-3 flex gap-3 transition-all duration-150 relative ${
                      isSelected
                        ? "bg-orange-50/70 border-l-[3px] border-l-orange-500"
                        : "hover:bg-secondary/50 border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarFallback className={`text-sm font-semibold ${color.bg} ${color.text}`}>
                        {getInitials(nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${isSelected ? "font-semibold" : "font-medium"}`}>{nome}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatTime(c.atualizado_em)}
                          </span>
                          {c.nao_lidas > 0 && (
                            <span className="h-5 min-w-5 px-1 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                              {c.nao_lidas}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">{c.lastMessage}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {c.ai_paused ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            <UserRound className="h-2.5 w-2.5" />
                            Humano
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
                            <Sparkles className="h-2.5 w-2.5" />
                            IA
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* ═══ CENTER PANEL — Chat ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            {/* Chat Header */}
            <div className="border-b bg-card">
              {/* Row 1: Identity */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").bg} ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").text}`}>
                      {getInitials(selected.customers?.nome || selected.cliente_nome || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-semibold leading-tight">{selected.customers?.nome || selected.cliente_nome || "Desconhecido"}</p>
                    <p className="text-sm text-muted-foreground">{formatPhone(selected.cliente_tel)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(true)}
                  className="xl:hidden p-2 rounded-lg hover:bg-accent transition-colors"
                  title="Detalhes do cliente"
                >
                  <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              {/* Row 2: Humano / IA toggle */}
              <div className="px-4 pb-2.5 flex items-center gap-2">
                {selected.ai_paused ? (
                  <div className="flex gap-1.5 items-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1 shadow-sm">
                      <UserRound className="h-3 w-3" />
                      Humano
                    </span>
                    <button
                      onClick={resumeAi}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                    >
                      <Bot className="h-3 w-3" />
                      Retomar IA
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 items-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 flex items-center gap-1 shadow-sm">
                      <Sparkles className="h-3 w-3" />
                      IA ativa
                    </span>
                    <button
                      onClick={async () => {
                        await supabase.from("conversations").update({ ai_paused: true }).eq("id", selected.id);
                        setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, ai_paused: true } : c));
                        toast({ title: "IA pausada nesta conversa" });
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
                    >
                      <UserRound className="h-3 w-3" />
                      Assumir conversa
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 bg-secondary/30" style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}>
              <div className="space-y-1 p-4">
                {loadingMsgs ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                      <MessageCircle className="h-7 w-7 text-orange-400" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">As mensagens aparecerão aqui</p>
                  </div>
                ) : (
                  messageGroups.map((group) => (
                    <div key={group.label}>
                      {/* Date Separator */}
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 rounded-full bg-card/80 backdrop-blur-sm text-xs font-medium text-muted-foreground shadow-sm border border-border/50">
                          {group.label}
                        </span>
                      </div>
                      {/* Messages */}
                      <div className="space-y-2.5">
                        {group.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.remetente === "cliente" ? "justify-start" : "justify-end"}`}>
                            {m.remetente === "ia" && (
                              <div className="flex items-end gap-2 max-w-[75%] flex-row-reverse">
                                <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mb-1">
                                  <Bot className="h-3.5 w-3.5 text-orange-600" />
                                </div>
                                <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-orange-500 text-white shadow-sm">
                                  <p style={{ whiteSpace: "pre-wrap" }}>{renderWhatsAppText(m.conteudo)}</p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <span className="text-[9px] font-medium text-white/80 uppercase">IA</span>
                                    <span className="text-xs text-white/50">·</span>
                                    <span className="text-xs text-white/50">{formatTime(m.criado_em)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {m.remetente === "cliente" && (
                              <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-blue-500 text-white shadow-sm">
                                <p style={{ whiteSpace: "pre-wrap" }}>{renderWhatsAppText(m.conteudo)}</p>
                                <p className="text-xs mt-1 text-white/60">{formatTime(m.criado_em)}</p>
                              </div>
                            )}
                            {m.remetente === "atendente" && (
                              <div className="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-orange-500 text-white shadow-sm">
                                <p style={{ whiteSpace: "pre-wrap" }}>{renderWhatsAppText(m.conteudo)}</p>
                                <p className="text-xs mt-1 text-white/60">{formatTime(m.criado_em)}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-3 bg-card border-t">
              <div className="flex items-end gap-2 bg-card rounded-2xl border shadow-sm px-2 py-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 h-9 w-9 text-muted-foreground hover:text-orange-500 rounded-xl"
                      onClick={sendCardapio}
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enviar cardápio</TooltipContent>
                </Tooltip>
                <Textarea
                  placeholder="Digite uma mensagem..."
                  className="min-h-[36px] max-h-[120px] resize-none text-sm border-0 shadow-none focus-visible:ring-0 px-1"
                  rows={1}
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !msgInput.trim()}
                  className="shrink-0 h-9 w-9 rounded-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white flex items-center justify-center transition-all duration-150"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Selecione uma conversa</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Escolha uma conversa ao lado para começar</p>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL — Customer Details ═══ */}
      {selected && (
        <div className="w-80 border-l shrink-0 bg-card overflow-y-auto hidden xl:block">
          {/* Customer Card */}
          <div className="p-5 text-center">
            <Avatar className="h-16 w-16 mx-auto ring-2 ring-orange-200 ring-offset-2">
              <AvatarFallback className={`text-lg font-bold ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").bg} ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").text}`}>
                {getInitials(selected.customers?.nome || selected.cliente_nome || "?")}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-3 font-semibold">{selected.customers?.nome || selected.cliente_nome || "Desconhecido"}</h3>
            {selected.customers?.telefone && (
              <a
                href={`https://wa.me/${selected.customers.telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-600 transition-colors mt-1"
              >
                <Phone className="h-3 w-3" />
                {formatPhone(selected.customers.telefone)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>

          <Separator />

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-px bg-border">
            <div className="bg-card p-3 text-center">
              <p className="text-xl font-bold tabular-nums">{selected.customers?.pedidos_count ?? selected.customers?.total_pedidos ?? 0}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pedidos</p>
            </div>
            <div className="bg-card p-3 text-center">
              <p className="text-sm font-bold tabular-nums">{formatCurrency(selected.customers?.total_gasto ?? 0)}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</p>
            </div>
            <div className="bg-card p-3 text-center">
              <p className="text-sm font-bold tabular-nums">{formatRelativeDate(selected.customers?.ultimo_pedido ?? null)}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Último</p>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações rápidas</h4>

            <div className="grid grid-cols-2 gap-2">
              {selected.customers?.telefone && (
                <a
                  href={`https://wa.me/${selected.customers.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                >
                  <Phone className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              )}
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-all">
                <ShoppingBag className="h-3.5 w-3.5" />
                Criar pedido
              </button>
            </div>
          </div>

          <Separator />

          {/* Conversation Info */}
          <div className="p-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversa</h4>
            <div className="space-y-2.5">
              {selected.customers?.endereco && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground leading-relaxed">{selected.customers.endereco}</p>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-foreground">
                  Criada em {new Date(selected.criado_em).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {selected.origem && (
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-foreground capitalize">{selected.origem}</p>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                {selected.ai_paused ? (
                  <>
                    <UserRound className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">Atendimento humano</p>
                  </>
                ) : (
                  <>
                    <Bot className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <p className="text-xs text-violet-700 font-medium">IA respondendo</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Observação do cliente */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observação</h4>
            <Textarea
              value={selected.customers?.notas ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setConversations(prev => prev.map(c =>
                  c.id === selectedId && c.customers
                    ? { ...c, customers: { ...c.customers, notas: val } }
                    : c
                ));
              }}
              onBlur={async (e) => {
                if (!selected.customer_id) return;
                await supabase
                  .from("customers")
                  .update({ notas: e.target.value || null })
                  .eq("id", selected.customer_id);
              }}
              placeholder="Ex: Alérgico a amendoim, prefere entrega rápida..."
              className="text-xs min-h-[60px] bg-secondary/50 border-0 resize-none"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Sheet for mobile/tablet — customer details drawer */}
      {selected && (
        <Sheet open={showDetails} onOpenChange={setShowDetails}>
          <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Detalhes do cliente</SheetTitle>
            </SheetHeader>
            {/* Customer Card */}
            <div className="p-5 pt-10 text-center">
              <Avatar className="h-16 w-16 mx-auto ring-2 ring-orange-200 ring-offset-2">
                <AvatarFallback className={`text-lg font-bold ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").bg} ${getAvatarColor(selected.customers?.nome || selected.cliente_nome || "?").text}`}>
                  {getInitials(selected.customers?.nome || selected.cliente_nome || "?")}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-3 font-semibold">{selected.customers?.nome || selected.cliente_nome || "Desconhecido"}</h3>
              {selected.customers?.telefone && (
                <a
                  href={`https://wa.me/${selected.customers.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-600 transition-colors mt-1"
                >
                  <Phone className="h-3 w-3" />
                  {formatPhone(selected.customers.telefone)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            <Separator />
            {/* Stats */}
            {selected.customers && (
              <div className="grid grid-cols-3 text-center py-3 px-2">
                <div><p className="text-lg font-bold">{selected.customers.total_pedidos ?? 0}</p><p className="text-[10px] text-muted-foreground uppercase">Pedidos</p></div>
                <div><p className="text-lg font-bold">R$ {((selected.customers.total_gasto ?? 0)).toFixed(2).replace(".", ",")}</p><p className="text-[10px] text-muted-foreground uppercase">Total</p></div>
                <div><p className="text-lg font-bold">{selected.customers.ultimo_pedido ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(-Math.round((Date.now() - new Date(selected.customers.ultimo_pedido).getTime()) / 86400000), "day") : "—"}</p><p className="text-[10px] text-muted-foreground uppercase">Último</p></div>
              </div>
            )}
            <Separator />
            {/* Quick Actions */}
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</h4>
              <div className="flex gap-2">
                <a href={`https://wa.me/${(selected.customers?.telefone || selected.cliente_tel || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 px-3 rounded-lg border text-xs font-medium hover:bg-accent transition-colors flex items-center justify-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <button className="flex-1 text-center py-2 px-3 rounded-lg border text-xs font-medium hover:bg-accent transition-colors flex items-center justify-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> Criar pedido
                </button>
              </div>
            </div>
            <Separator />
            {/* Observação */}
            <div className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observação</h4>
              <Textarea
                value={selected.customers?.notas ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setConversations(prev => prev.map(c =>
                    c.id === selectedId && c.customers
                      ? { ...c, customers: { ...c.customers, notas: val } }
                      : c
                  ));
                }}
                onBlur={async (e) => {
                  if (!selected.customer_id) return;
                  await supabase.from("customers").update({ notas: e.target.value || null }).eq("id", selected.customer_id);
                }}
                placeholder="Ex: Alérgico a amendoim, prefere entrega rápida..."
                className="text-xs min-h-[60px] bg-secondary/50 border-0 resize-none"
                rows={2}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
