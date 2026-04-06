"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot, Clock, Power, MessageCircle, Save, Loader2, CheckCircle2,
  Megaphone, Plus, Send, Users, Calendar, Trash2, Upload, Truck, Pencil,
  Sparkles, CreditCard, Store,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  nome: string;
  mensagem: string;
  tipo: "promocao" | "cupom" | "aviso";
  filtro_tipo: string;
  filtro_valor: number | null;
  status: "rascunho" | "agendada" | "enviando" | "enviada" | "cancelada";
  agendado_para: string | null;
  total_destinatarios: number;
  total_enviados: number;
  total_erros: number;
  criado_em: string;
}

const tipoLabel: Record<string, string> = {
  promocao: "Promoção",
  cupom: "Cupom de desconto",
  aviso: "Aviso geral",
};

const tiposEstabelecimento = [
  "hamburgueria", "pizzaria", "acai", "crepe",
  "marmitaria", "japonesa", "brasileira", "outro",
];

const estabelecimentoLabel: Record<string, string> = {
  hamburgueria: "Hamburgueria", pizzaria: "Pizzaria", acai: "Açaiteria",
  crepe: "Creperia", marmitaria: "Marmitaria", japonesa: "Japonesa",
  brasileira: "Brasileira", outro: "Outro",
};

const tipoColor: Record<string, string> = {
  promocao: "bg-orange-100 text-orange-700",
  cupom: "bg-emerald-100 text-emerald-700",
  aviso: "bg-blue-100 text-blue-700",
};

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  enviando: "Enviando...",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

const statusColor: Record<string, string> = {
  rascunho: "bg-secondary text-muted-foreground",
  agendada: "bg-blue-100 text-blue-700",
  enviando: "bg-amber-100 text-amber-700",
  enviada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-red-100 text-red-700",
};

const filtroLabels: Record<string, string> = {
  todos: "Todos os clientes",
  recentes: "Compraram nos últimos X dias",
  inativos: "Não compram há X dias",
  vip: "Mais de X pedidos",
};

const templates: Record<string, string> = {
  promocao: "Ola {nome}! Temos uma promocao especial para voce. Aproveite nossos precos exclusivos somente hoje! Faca seu pedido pelo WhatsApp.",
  cupom: "Ola {nome}! Voce ganhou um cupom de desconto exclusivo. Use o codigo DESCONTO10 no seu proximo pedido e ganhe 10% OFF!",
  aviso: "Ola {nome}! Informamos que nosso estabelecimento estara fechado amanha. Voltamos ao funcionamento normal no dia seguinte. Obrigado!",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Automations() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("atendimento");

  // Atendimento state
  const [enabled, setEnabled] = useState(true);
  const [schedule, setSchedule] = useState({ enabled: true, start: "11:00", end: "23:00" });
  const [msgForaHora, setMsgForaHora] = useState("");
  const [msgForaHoraActive, setMsgForaHoraActive] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState("");
  const [tempoEntrega, setTempoEntrega] = useState("");
  const [areaEntrega, setAreaEntrega] = useState("");
  const [formasPagamento, setFormasPagamento] = useState("");

  // Perfil IA state (de profiles)
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilNome, setPerfilNome] = useState("");
  const [perfilTipo, setPerfilTipo] = useState("");
  const [perfilDescricao, setPerfilDescricao] = useState("");
  const [perfilTelCozinha, setPerfilTelCozinha] = useState("");

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    nome: "",
    mensagem: "",
    tipo: "promocao" as "promocao" | "cupom" | "aviso",
    filtro_tipo: "todos",
    filtro_valor: 30,
    agendado_para: "",
  });
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);
  const [customerCount, setCustomerCount] = useState(0);

  // Import leads state
  const [importDialog, setImportDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data: settings } = await supabase
      .from("automation_settings")
      .select("ativo, horario_ativo, horario_inicio, horario_fim, msg_fora_hora, taxa_entrega, tempo_entrega_min, area_entrega, formas_pagamento")
      .eq("user_id", user.id)
      .single();

    if (settings) {
      setEnabled(settings.ativo ?? true);
      setSchedule({
        enabled: settings.horario_ativo ?? true,
        start: settings.horario_inicio?.slice(0, 5) || "11:00",
        end: settings.horario_fim?.slice(0, 5) || "23:00",
      });
      setMsgForaHora(settings.msg_fora_hora || "");
      setMsgForaHoraActive(!!settings.msg_fora_hora);
      setTaxaEntrega(settings.taxa_entrega?.toString() || "0");
      setTempoEntrega(settings.tempo_entrega_min?.toString() || "45");
      setAreaEntrega(settings.area_entrega || "");
      setFormasPagamento(settings.formas_pagamento || "");
    }

    // Carrega perfil para a IA
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome, tipo_estabelecimento, descricao_estabelecimento, telefone_cozinha")
      .eq("id", user.id)
      .single();

    if (perfil) {
      setPerfilNome(perfil.nome || "");
      setPerfilTipo(perfil.tipo_estabelecimento || "");
      setPerfilDescricao(perfil.descricao_estabelecimento || "");
      setPerfilTelCozinha(perfil.telefone_cozinha || "");
    }

    // Load campaigns
    const { data: campData } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("criado_em", { ascending: false });

    setCampaigns(campData || []);

    // Customer count
    const { count } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setCustomerCount(count ?? 0);

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Save atendimento ──────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("automation_settings")
      .update({
        ativo: enabled,
        horario_ativo: schedule.enabled,
        horario_inicio: schedule.start,
        horario_fim: schedule.end,
        msg_fora_hora: msgForaHoraActive ? msgForaHora : null,
        taxa_entrega: parseFloat(taxaEntrega) || 0,
        tempo_entrega_min: parseInt(tempoEntrega) || 45,
        area_entrega: areaEntrega || null,
        formas_pagamento: formasPagamento || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: "Configurações salvas!" });
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  // ─── Save perfil IA ───────────────────────────────────────────────────────

  const handleSavePerfil = async () => {
    if (!user) return;
    setSavingPerfil(true);
    const { error } = await supabase.from("profiles").update({
      nome: perfilNome,
      tipo_estabelecimento: perfilTipo || null,
      descricao_estabelecimento: perfilDescricao || null,
      telefone_cozinha: perfilTelCozinha || null,
      atualizado_em: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil da IA salvo!" });
    }
    setSavingPerfil(false);
  };

  // ─── Campaign actions ──────────────────────────────────────────────────────

  const openNewCampaign = (tipo: "promocao" | "cupom" | "aviso" = "promocao") => {
    setEditingCampaign(null);
    setCampaignForm({
      nome: "",
      mensagem: templates[tipo],
      tipo,
      filtro_tipo: "todos",
      filtro_valor: 30,
      agendado_para: "",
    });
    setCampaignDialog(true);
  };

  const openEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      nome: c.nome,
      mensagem: c.mensagem,
      tipo: c.tipo,
      filtro_tipo: c.filtro_tipo,
      filtro_valor: c.filtro_valor ?? 30,
      agendado_para: c.agendado_para
        ? new Date(c.agendado_para).toISOString().slice(0, 16)
        : "",
    });
    setCampaignDialog(true);
  };

  const saveCampaign = async (sendNow = false) => {
    if (!user || !campaignForm.nome.trim() || !campaignForm.mensagem.trim()) {
      toast({ title: "Preencha nome e mensagem", variant: "destructive" });
      return;
    }

    const data = {
      user_id: user.id,
      nome: campaignForm.nome,
      mensagem: campaignForm.mensagem,
      tipo: campaignForm.tipo,
      filtro_tipo: campaignForm.filtro_tipo,
      filtro_valor: campaignForm.filtro_tipo !== "todos" ? campaignForm.filtro_valor : null,
      status: sendNow ? "enviando" : (campaignForm.agendado_para ? "agendada" : "rascunho"),
      agendado_para: campaignForm.agendado_para || null,
      total_destinatarios: 0,
      total_enviados: 0,
      total_erros: 0,
    };

    let campaignId: string | null = null;

    if (editingCampaign) {
      const { error } = await supabase
        .from("campaigns")
        .update(data)
        .eq("id", editingCampaign.id)
        .eq("user_id", user.id);
      if (error) {
        toast({ title: "Erro ao salvar campanha", description: error.message, variant: "destructive" });
        return;
      }
      campaignId = editingCampaign.id;
    } else {
      const { data: newCamp, error } = await supabase
        .from("campaigns")
        .insert(data)
        .select("id")
        .single();
      if (error) {
        toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
        return;
      }
      campaignId = newCamp.id;
    }

    setCampaignDialog(false);
    await loadData();

    if (sendNow && campaignId) {
      executeCampaign(campaignId);
    }
  };

  const executeCampaign = async (campaignId: string) => {
    if (!user || !session) return;
    setSendingCampaign(campaignId);

    // Get campaign
    const { data: camp } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!camp) { setSendingCampaign(null); return; }

    // Get automation settings for Evolution API
    const { data: settings } = await supabase
      .from("automation_settings")
      .select("evolution_api_url, evolution_instance, evolution_api_key")
      .eq("user_id", user.id)
      .single();

    if (!settings?.evolution_api_url || !settings?.evolution_api_key) {
      toast({ title: "Configure o WhatsApp primeiro", description: "Vá em WhatsApp para conectar sua instância", variant: "destructive" });
      setSendingCampaign(null);
      return;
    }

    // Get customers based on filter
    let query = supabase.from("customers").select("id, nome, telefone").eq("user_id", user.id);

    if (camp.filtro_tipo === "recentes" && camp.filtro_valor) {
      const since = new Date();
      since.setDate(since.getDate() - camp.filtro_valor);
      query = query.gte("ultima_interacao", since.toISOString());
    } else if (camp.filtro_tipo === "inativos" && camp.filtro_valor) {
      const since = new Date();
      since.setDate(since.getDate() - camp.filtro_valor);
      query = query.lt("ultima_interacao", since.toISOString());
    } else if (camp.filtro_tipo === "vip" && camp.filtro_valor) {
      query = query.gte("total_pedidos", camp.filtro_valor);
    }

    const { data: customers } = await query;
    const destinatarios = (customers || []).slice(0, 50); // Limite de 50

    // Update campaign total
    await supabase
      .from("campaigns")
      .update({ status: "enviando", total_destinatarios: destinatarios.length })
      .eq("id", campaignId);

    await loadData();

    let enviados = 0;
    let erros = 0;

    for (const customer of destinatarios) {
      if (!customer.telefone) { erros++; continue; }

      const mensagem = camp.mensagem.replace(/\{nome\}/g, customer.nome || "Cliente");
      const phone = customer.telefone.replace(/\D/g, "");

      try {
        const url = `${settings.evolution_api_url}/message/sendText/${settings.evolution_instance}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: settings.evolution_api_key },
          body: JSON.stringify({ number: phone, text: mensagem }),
        });

        if (res.ok) {
          enviados++;
        } else {
          erros++;
        }
      } catch {
        erros++;
      }

      // Update progresso
      await supabase
        .from("campaigns")
        .update({ total_enviados: enviados, total_erros: erros })
        .eq("id", campaignId);

      // Delay 60s entre envios (exceto o ultimo)
      if (destinatarios.indexOf(customer) < destinatarios.length - 1) {
        await new Promise(r => setTimeout(r, 60000));
      }
    }

    // Finalizar
    await supabase
      .from("campaigns")
      .update({ status: "enviada", total_enviados: enviados, total_erros: erros })
      .eq("id", campaignId);

    setSendingCampaign(null);
    await loadData();
    toast({ title: "Campanha enviada!", description: `${enviados} enviadas, ${erros} erros` });
  };

  const deleteCampaign = async (id: string) => {
    if (!user) return;
    await supabase.from("campaigns").delete().eq("id", id).eq("user_id", user.id);
    await loadData();
    toast({ title: "Campanha excluída" });
  };

  // ─── Import leads ──────────────────────────────────────────────────────────

  const importLeads = async () => {
    if (!user || !importText.trim()) return;
    setImporting(true);

    // Parse: aceita CSV (nome,telefone) ou só telefone por linha
    const lines = importText.trim().split("\n").map(l => l.trim()).filter(Boolean);
    let imported = 0;
    let skipped = 0;

    for (const line of lines) {
      let nome = "Cliente";
      let telefone = "";

      if (line.includes(",") || line.includes(";") || line.includes("\t")) {
        const parts = line.split(/[,;\t]/).map(p => p.trim());
        if (parts.length >= 2) {
          nome = parts[0] || "Cliente";
          telefone = parts[1];
        } else {
          telefone = parts[0];
        }
      } else {
        telefone = line;
      }

      // Limpar telefone
      telefone = telefone.replace(/\D/g, "");
      if (telefone.length === 11) telefone = "55" + telefone;
      if (telefone.length === 10) telefone = "55" + telefone;

      if (telefone.length < 12) { skipped++; continue; }

      // Verificar duplicata
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user.id)
        .eq("telefone", telefone)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          nome,
          telefone,
        });

      if (!error) imported++;
      else skipped++;
    }

    setImporting(false);
    setImportDialog(false);
    setImportText("");
    await loadData();
    toast({
      title: "Importação concluída",
      description: `${imported} contatos importados, ${skipped} ignorados (duplicados ou inválidos)`,
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[960px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
          <p className="text-muted-foreground text-sm mt-1">Atendimento automático e campanhas de marketing</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={enabled ? "default" : "secondary"} className="gap-1.5">
            <Power className="h-3 w-3" />{enabled ? "Ativo" : "Inativo"}
          </Badge>
          <Switch checked={enabled} onCheckedChange={async (v) => {
            setEnabled(v);
            if (!user) return;
            await supabase
              .from("automation_settings")
              .update({ ativo: v, atualizado_em: new Date().toISOString() })
              .eq("user_id", user.id);
            toast({ title: v ? "IA ativada" : "IA desativada" });
          }} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="atendimento" className="gap-1.5"><Bot className="h-4 w-4" />Atendimento</TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-1.5"><Megaphone className="h-4 w-4" />Campanhas</TabsTrigger>
        </TabsList>

        {/* ── TAB: Atendimento ─────────────────────────────────────────────── */}
        <TabsContent value="atendimento" className="space-y-6 mt-0">

          {/* IA info */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Atendimento com IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A IA responde automaticamente com base no seu cardápio, preços e configurações.
                O prompt é montado automaticamente quando você altera itens na aba Cardápio.
              </p>
            </CardContent>
          </Card>

          {/* Perfil do Restaurante para IA */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Perfil do Restaurante</CardTitle>
              </div>
              <CardDescription>A IA usa esses dados para se apresentar e contextualizar o atendimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do restaurante</Label>
                  <Input
                    value={perfilNome}
                    onChange={e => setPerfilNome(e.target.value)}
                    placeholder="Ex: Pizzaria do João"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de estabelecimento</Label>
                  <Select value={perfilTipo} onValueChange={setPerfilTipo}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {tiposEstabelecimento.map(t => (
                        <SelectItem key={t} value={t}>{estabelecimentoLabel[t] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição para a IA</Label>
                <Textarea
                  value={perfilDescricao}
                  onChange={e => setPerfilDescricao(e.target.value)}
                  rows={2}
                  placeholder="Ex: Melhor pizza artesanal da cidade, desde 2010. Especialidade em bordas recheadas."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone da cozinha (notificação de pedidos)</Label>
                <Input
                  value={perfilTelCozinha}
                  onChange={e => setPerfilTelCozinha(e.target.value)}
                  placeholder="Ex: 5531999990000"
                />
                <p className="text-[11px] text-muted-foreground">Número com DDI+DDD. A IA envia aqui quando confirmar um pedido.</p>
              </div>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                onClick={handleSavePerfil}
                disabled={savingPerfil}
              >
                {savingPerfil ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingPerfil ? "Salvando..." : "Salvar perfil"}
              </Button>
            </CardContent>
          </Card>

          {/* Entrega */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Entrega</CardTitle>
              </div>
              <CardDescription>A IA usa esses valores para informar o cliente sobre frete e prazo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Taxa de entrega (R$)</Label>
                  <Input
                    type="number"
                    step="0.50"
                    value={taxaEntrega}
                    onChange={e => setTaxaEntrega(e.target.value)}
                    placeholder="5.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tempo estimado (minutos)</Label>
                  <Input
                    type="number"
                    value={tempoEntrega}
                    onChange={e => setTempoEntrega(e.target.value)}
                    placeholder="45"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cidade / Região atendida</Label>
                <Input
                  value={areaEntrega}
                  onChange={e => setAreaEntrega(e.target.value)}
                  placeholder="Ex: Piumhi e região"
                />
              </div>
            </CardContent>
          </Card>

          {/* Horário */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Horário de funcionamento</CardTitle>
              </div>
              <CardDescription>Fora do horário, a IA não responde e envia a mensagem automática abaixo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Restringir por horário</Label>
                <Switch checked={schedule.enabled} onCheckedChange={(v) => setSchedule({ ...schedule, enabled: v })} />
              </div>
              {schedule.enabled && (
                <div className="flex items-center gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <Input type="time" value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} className="w-32" />
                  </div>
                  <span className="text-muted-foreground mt-5">até</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fim</Label>
                    <Input type="time" value={schedule.end} onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} className="w-32" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mensagem fora do horário */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Mensagem fora do horário</CardTitle>
              </div>
              <CardDescription>Enviada automaticamente quando cliente manda mensagem fora do horário</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm">Ativada</Label>
                <Switch checked={msgForaHoraActive} onCheckedChange={setMsgForaHoraActive} />
              </div>
              <Textarea
                value={msgForaHora}
                onChange={(e) => setMsgForaHora(e.target.value)}
                rows={3}
                className="text-sm"
                disabled={!msgForaHoraActive}
                placeholder="Ex: Olá! Estamos fechados no momento. Nosso horário é das 11h às 23h."
              />
            </CardContent>
          </Card>

          {/* Formas de Pagamento */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Formas de pagamento</CardTitle>
              </div>
              <CardDescription>A IA informa essas opções quando o cliente perguntar como pagar</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formasPagamento}
                onChange={e => setFormasPagamento(e.target.value)}
                rows={3}
                className="text-sm"
                placeholder={"Ex: Pix (chave: 11999990000), Dinheiro (troco até R$50), Cartão na entrega (débito e crédito)"}
              />
            </CardContent>
          </Card>

          {/* Save */}
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar configurações"}
          </Button>
        </TabsContent>

        {/* ── TAB: Campanhas ───────────────────────────────────────────────── */}
        <TabsContent value="campanhas" className="space-y-6 mt-0">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Envie mensagens em massa para seus clientes. Limite: 50 mensagens por campanha, 1 por minuto.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <Users className="h-3 w-3 inline mr-1" />{customerCount} clientes cadastrados
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialog(true)} className="gap-1.5">
                <Upload className="h-4 w-4" />Importar contatos
              </Button>
              <Button onClick={() => openNewCampaign()} className="gap-1.5">
                <Plus className="h-4 w-4" />Nova campanha
              </Button>
            </div>
          </div>

          {/* Templates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["promocao", "cupom", "aviso"] as const).map(tipo => (
              <Card
                key={tipo}
                className="shadow-sm cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-orange-200"
                onClick={() => openNewCampaign(tipo)}
              >
                <CardContent className="p-4 text-center">
                  <Badge className={`${tipoColor[tipo]} mb-2`}>{tipoLabel[tipo]}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tipo === "promocao" && "Divulgue ofertas e promoções"}
                    {tipo === "cupom" && "Envie cupons de desconto"}
                    {tipo === "aviso" && "Comunique avisos gerais"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Campaign list */}
          {campaigns.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma campanha criada ainda. Clique em "Nova campanha" para começar.
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de campanhas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Enviadas</TableHead>
                      <TableHead className="text-right">Erros</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.agendado_para
                              ? `Agendada: ${new Date(c.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                              : new Date(c.criado_em).toLocaleDateString("pt-BR")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${tipoColor[c.tipo]}`}>{tipoLabel[c.tipo]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColor[c.status]}`}>{statusLabel[c.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {c.total_enviados}/{c.total_destinatarios}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-red-500">
                          {c.total_erros || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {(c.status === "rascunho" || c.status === "agendada") && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => executeCampaign(c.id)}
                                disabled={!!sendingCampaign}
                              >
                                <Send className="h-3 w-3" />Enviar
                              </Button>
                            )}
                            {(c.status === "rascunho" || c.status === "agendada") && (
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                onClick={() => openEditCampaign(c)}
                                title="Editar campanha"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {(c.status === "rascunho" || c.status === "agendada" || c.status === "cancelada") && (
                              <Button
                                size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteCampaign(c.id)}
                                title="Excluir campanha"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Campaign Dialog ──────────────────────────────────────────────── */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input
                value={campaignForm.nome}
                onChange={e => setCampaignForm({ ...campaignForm, nome: e.target.value })}
                placeholder="Ex: Promoção de Sexta"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={campaignForm.tipo}
                onValueChange={v => {
                  const tipo = v as "promocao" | "cupom" | "aviso";
                  setCampaignForm({
                    ...campaignForm,
                    tipo,
                    mensagem: campaignForm.mensagem || templates[tipo],
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="promocao">Promoção</SelectItem>
                  <SelectItem value="cupom">Cupom de desconto</SelectItem>
                  <SelectItem value="aviso">Aviso geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={campaignForm.mensagem}
                onChange={e => setCampaignForm({ ...campaignForm, mensagem: e.target.value })}
                rows={4}
                placeholder="Use {nome} para inserir o nome do cliente"
              />
              <p className="text-xs text-muted-foreground">Use <code className="bg-secondary px-1 rounded">{"{nome}"}</code> para personalizar com o nome do cliente</p>
            </div>
            <div className="space-y-2">
              <Label>Público-alvo</Label>
              <Select
                value={campaignForm.filtro_tipo}
                onValueChange={v => setCampaignForm({ ...campaignForm, filtro_tipo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(filtroLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {campaignForm.filtro_tipo !== "todos" && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    value={campaignForm.filtro_valor}
                    onChange={e => setCampaignForm({ ...campaignForm, filtro_valor: parseInt(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    {campaignForm.filtro_tipo === "vip" ? "pedidos" : "dias"}
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Agendamento (opcional)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="datetime-local"
                  value={campaignForm.agendado_para}
                  onChange={e => setCampaignForm({ ...campaignForm, agendado_para: e.target.value })}
                  className="w-auto"
                />
                {campaignForm.agendado_para && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setCampaignForm({ ...campaignForm, agendado_para: "" })}
                  >
                    Limpar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {campaignForm.agendado_para
                  ? `Será enviada em ${new Date(campaignForm.agendado_para).toLocaleString("pt-BR")}`
                  : "Deixe vazio para enviar agora ou salvar como rascunho"}
              </p>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Máximo 50 destinatários por campanha. Intervalo de 60s entre envios.
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setCampaignDialog(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => saveCampaign(false)}>Salvar rascunho</Button>
            {campaignForm.agendado_para ? (
              <Button className="bg-blue-500 hover:bg-blue-600 gap-1.5" onClick={() => saveCampaign(false)}>
                <Calendar className="h-4 w-4" />Agendar
              </Button>
            ) : (
              <Button className="bg-orange-500 hover:bg-orange-600 gap-1.5" onClick={() => saveCampaign(true)}>
                <Send className="h-4 w-4" />Enviar agora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Leads Dialog ──────────────────────────────────────────── */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar contatos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole sua lista de contatos abaixo. Aceita dois formatos:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-xs font-semibold mb-1">Formato 1: Nome + Telefone</p>
                <pre className="text-[11px] text-muted-foreground bg-secondary p-2 rounded">
{`João Silva, 11999887766
Maria Santos, 21988776655
Pedro Costa, 31977665544`}
                </pre>
              </Card>
              <Card className="p-3">
                <p className="text-xs font-semibold mb-1">Formato 2: Só telefone</p>
                <pre className="text-[11px] text-muted-foreground bg-secondary p-2 rounded">
{`11999887766
21988776655
31977665544`}
                </pre>
              </Card>
            </div>
            {/* Upload CSV */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                id="csv-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = ev.target?.result as string;
                    setImportText(prev => prev ? prev + "\n" + content : content);
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="w-full gap-1.5 border-dashed"
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload arquivo (.csv, .txt)
              </Button>
            </div>

            <div className="relative">
              <span className="absolute -top-2.5 left-3 bg-background px-1 text-[10px] text-muted-foreground">ou cole manualmente</span>
              <Textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={8}
                placeholder="Cole os contatos aqui, um por linha..."
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {importText.trim() ? `${importText.trim().split("\n").filter(Boolean).length} linha(s) detectada(s)` : "Nenhum contato"}
              </p>
              <p className="text-xs text-muted-foreground">
                Duplicados e inválidos são ignorados automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialog(false); setImportText(""); }}>Cancelar</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-1.5"
              onClick={importLeads}
              disabled={importing || !importText.trim()}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Importando..." : "Importar contatos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
