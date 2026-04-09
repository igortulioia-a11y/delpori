"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Store, Link2, Loader2, Smartphone, CheckCircle2, XCircle,
  RefreshCw, Wifi, WifiOff, QrCode, AlertCircle, Clock,
  Users, Mail, Trash2, ShieldCheck, UserPlus, Upload, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Team Types ───────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  email: string;
  nome: string | null;
  permissoes: string[];
  status: "pendente" | "ativo";
}

const abasDisponiveis = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "conversas",     label: "Conversas" },
  { key: "pedidos",       label: "Pedidos" },
  { key: "cardapio",      label: "Cardápio" },
  { key: "automacoes",    label: "Automações" },
  { key: "configuracoes", label: "Configurações" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type WAStatus = "pendente" | "aguardando_qr" | "conectado" | "desconectado" | "erro";

interface AutomationInfo {
  whatsapp_status: WAStatus;
  whatsapp_qr: string | null;
  whatsapp_phone: string | null;
  evolution_instance: string | null;
  onboarding_done: boolean;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const integrations = [
  { nome: "iFood",        descricao: "Integração com iFood" },
  { nome: "Rappi",        descricao: "Integração com Rappi" },
  { nome: "UaiRango",     descricao: "Integração com UaiRango" },
  { nome: "Mercado Pago", descricao: "Receba pagamentos online" },
];

const waStatusConfig: Record<WAStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente:      { label: "Aguardando configuração", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",            icon: <Clock className="h-3 w-3" /> },
  aguardando_qr: { label: "Aguardando QR code",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",           icon: <QrCode className="h-3 w-3" /> },
  conectado:     { label: "Conectado",                color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",       icon: <CheckCircle2 className="h-3 w-3" /> },
  desconectado:  { label: "Desconectado",             color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",               icon: <XCircle className="h-3 w-3" /> },
  erro:          { label: "Erro de conexão",          color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",               icon: <AlertCircle className="h-3 w-3" /> },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, session, teamRole } = useAuth();
  const [activeTab, setActiveTab] = useState("restaurante");

  // ── Team state ─────────────────────────────────────────────────────────────
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [invitePerms, setInvitePerms]   = useState<string[]>(["conversas", "pedidos"]);
  const [inviting, setInviting]         = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editPerms, setEditPerms]       = useState<string[]>([]);

  const loadMembers = useCallback(async () => {
    if (!user) return;
    setLoadingMembers(true);
    const { data } = await supabase
      .from("team_members")
      .select("id, email, nome, permissoes, status")
      .eq("owner_id", user.id)
      .order("criado_em");
    setMembers((data as TeamMember[]) ?? []);
    setLoadingMembers(false);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "usuarios") loadMembers();
  }, [activeTab, loadMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !session) return;
    setInviting(true);
    const res = await fetch("/api/invite-member", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ email: inviteEmail.trim(), permissoes: invitePerms }),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: "Convite enviado!", description: `E-mail enviado para ${inviteEmail.trim()}` });
      setInviteEmail("");
      setInvitePerms(["conversas", "pedidos"]);
      loadMembers();
    } else {
      toast({ title: "Erro ao convidar", description: data.error, variant: "destructive" });
    }
    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!session) return;
    const res = await fetch("/api/invite-member", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) {
      toast({ title: "Membro removido" });
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const handleSavePerms = async (memberId: string) => {
    if (!session) return;
    const res = await fetch("/api/invite-member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ memberId, permissoes: editPerms }),
    });
    if (res.ok) {
      toast({ title: "Permissões atualizadas" });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, permissoes: editPerms } : m));
      setEditingMember(null);
    }
  };

  const toggleInvitePerm = (key: string) =>
    setInvitePerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  const toggleEditPerm = (key: string) =>
    setEditPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  // ── Restaurante state ──────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [restaurante, setRestaurante] = useState({
    telefone: "", endereco: "", slug: "", logo_url: "",
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 2MB", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const urlWithCache = `${data.publicUrl}?t=${Date.now()}`;
      setRestaurante(r => ({ ...r, logo_url: urlWithCache }));
      // Salvar no banco automaticamente
      await supabase.from("profiles").update({ logo_url: urlWithCache, atualizado_em: new Date().toISOString() }).eq("id", user.id);
      toast({ title: "Logo atualizado!" });
    }
    setUploadingLogo(false);
  };

  const loadProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setRestaurante({
        telefone:  data.telefone || "",
        endereco:  data.endereco || "",
        slug:      data.slug || "",
        logo_url:  data.logo_url || "",
      });
    }
    if (error && error.code !== "PGRST116") {
      toast({ title: "Erro ao carregar perfil", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const slugNormalizado = restaurante.slug ? normalizeSlug(restaurante.slug) : null;
    const { error } = await supabase.from("profiles").update({
      telefone: restaurante.telefone,
      endereco: restaurante.endereco,
      slug: slugNormalizado,
      logo_url: restaurante.logo_url || null,
      atualizado_em: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
    }
    setSaving(false);
  };

  // ── WhatsApp state ─────────────────────────────────────────────────────────
  const [waInfo, setWaInfo]         = useState<AutomationInfo | null>(null);
  const [qrData, setQrData]         = useState<string | null>(null);
  const [waLoading, setWaLoading]   = useState(true);
  const [loadingQr, setLoadingQr]   = useState(false);
  const [waError, setWaError]       = useState("");

  const loadWaStatus = useCallback(async () => {
    if (!user) { setWaLoading(false); return; }
    const { data, error } = await supabase
      .from("automation_settings")
      .select("whatsapp_status, whatsapp_qr, whatsapp_phone, evolution_instance, onboarding_done")
      .eq("user_id", user.id)
      .single();
    if (!error && data) setWaInfo(data as AutomationInfo);
    setWaLoading(false);
  }, [user?.id]);

  useEffect(() => { loadWaStatus(); }, [loadWaStatus]);

  // Poll while waiting for QR scan
  useEffect(() => {
    if (waInfo?.whatsapp_status !== "aguardando_qr") return;
    const interval = setInterval(() => loadWaStatus(), 5000);
    return () => clearInterval(interval);
  }, [waInfo?.whatsapp_status, loadWaStatus]);

  // Realtime update for WhatsApp status
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wa-status-cfg")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "automation_settings", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setWaInfo(payload.new as AutomationInfo);
          if ((payload.new as AutomationInfo).whatsapp_status === "conectado") setQrData(null);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchQrCode = async () => {
    setLoadingQr(true);
    setWaError("");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) throw new Error("Sessão expirada");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-whatsapp-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${s.access_token}`,
          },
        }
      );
      const data = await res.json();

      if (data?.base64) {
        // Evolution retorna base64 com prefixo "data:image/png;base64,..." — usar direto como img src
        setQrData(data.base64);
        await supabase.from("automation_settings")
          .update({ whatsapp_status: "aguardando_qr", whatsapp_qr: data.base64 })
          .eq("user_id", user?.id);
        await loadWaStatus();
      } else if (data?.instance?.state === "open") {
        await supabase.from("automation_settings")
          .update({ whatsapp_status: "conectado", onboarding_done: true })
          .eq("user_id", user?.id);
        await loadWaStatus();
      } else {
        setWaError(data?.error || "Não foi possível gerar o QR code. Tente novamente.");
      }
    } catch (e: any) {
      setWaError(e.message || "Erro ao buscar QR code.");
    }
    setLoadingQr(false);
  };

  const waStatus = waInfo?.whatsapp_status ?? "pendente";
  const waCfg = waStatusConfig[waStatus];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie as configurações do seu restaurante</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="restaurante" className="gap-2">
            <Store className="h-4 w-4" />Restaurante
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Smartphone className="h-4 w-4" />WhatsApp
          </TabsTrigger>
          {teamRole === "owner" && (
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" />Usuários
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Aba Restaurante ─────────────────────────────────────────────── */}
        <TabsContent value="restaurante" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Contato e Links</CardTitle>
              </div>
              <CardDescription>Telefone e cardápio digital</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={restaurante.telefone} onChange={(e) => setRestaurante({ ...restaurante, telefone: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Slug do cardápio</Label>
                <Input
                  value={restaurante.slug}
                  onChange={(e) => setRestaurante({ ...restaurante, slug: normalizeSlug(e.target.value) })}
                  placeholder="meu-restaurante"
                />
                {restaurante.slug && (
                  <a
                    href={`/cardapio/${restaurante.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver cardápio: /cardapio/{restaurante.slug}
                  </a>
                )}
                <p className="text-xs text-muted-foreground">
                  Use apenas letras minúsculas, números e hífen. Sem espaços ou acentos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  {restaurante.logo_url && (
                    <img src={restaurante.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover border" />
                  )}
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={restaurante.logo_url}
                      onChange={(e) => setRestaurante({ ...restaurante, logo_url: e.target.value })}
                      placeholder="https://... ou faça upload"
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={uploadingLogo} asChild>
                      <label className="cursor-pointer">
                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadingLogo ? "Enviando..." : "Upload"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              <Button className="mt-2" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Integrações</CardTitle>
              </div>
              <CardDescription>Conecte ferramentas externas ao seu delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {integrations.map((int) => (
                  <div key={int.nome} className="border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{int.nome}</p>
                      <p className="text-xs text-muted-foreground">{int.descricao}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">Em breve</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba WhatsApp ────────────────────────────────────────────────── */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="mb-2">
            <p className="text-sm text-muted-foreground">
              Conecte seu número do WhatsApp para ativar o atendimento automático com IA
            </p>
          </div>

          {waLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Status card */}
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        waStatus === "conectado" ? "bg-emerald-100" : "bg-gray-100"
                      }`}>
                        {waStatus === "conectado"
                          ? <Wifi className="h-6 w-6 text-emerald-600" />
                          : <WifiOff className="h-6 w-6 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {waStatus === "conectado"
                            ? `+${waInfo?.whatsapp_phone || "Número conectado"}`
                            : "Nenhum número conectado"}
                        </p>
                        <Badge className={`gap-1 text-xs mt-1 ${waCfg.color}`}>
                          {waCfg.icon} {waCfg.label}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={loadWaStatus} className="h-8 w-8">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {waInfo?.evolution_instance && (
                    <p className="text-xs text-muted-foreground mt-3 font-mono bg-secondary/50 rounded px-2 py-1">
                      Instância: {waInfo.evolution_instance}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Conectado */}
              {waStatus === "conectado" && (
                <Card className="shadow-sm border-emerald-200 dark:border-emerald-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-semibold">WhatsApp conectado com sucesso! 🎉</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          A IA já está pronta para atender seus clientes automaticamente.
                          Configure o comportamento em <strong>Automações</strong>.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      className="mt-4 text-destructive hover:text-destructive"
                      disabled={loadingQr}
                      onClick={async () => {
                        setLoadingQr(true);
                        try {
                          const { data: { session: s } } = await supabase.auth.getSession();
                          if (!s) throw new Error("Sessão expirada");
                          const res = await fetch(
                            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/disconnect-whatsapp`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${s.access_token}`,
                              },
                            }
                          );
                          const data = await res.json();
                          if (data.success) {
                            toast({ title: "WhatsApp desconectado com sucesso" });
                            setQrData(null);
                          } else {
                            toast({ title: "Erro ao desconectar", description: data.error, variant: "destructive" });
                          }
                        } catch (e: any) {
                          toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" });
                        }
                        setLoadingQr(false);
                        await loadWaStatus();
                      }}
                    >
                      {loadingQr ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Desconectando...</> : "Desconectar WhatsApp"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Configuração em andamento */}
              {!waInfo?.onboarding_done && waStatus === "pendente" && (
                <Card className="shadow-sm border-amber-200 dark:border-amber-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                      <CardTitle className="text-base">Configuração em andamento</CardTitle>
                    </div>
                    <CardDescription>
                      Seu ambiente está sendo configurado automaticamente. Isso leva menos de 1 minuto.
                      A página atualiza sozinha.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* QR Code */}
              {(waStatus === "aguardando_qr" || waStatus === "desconectado" || (waInfo?.onboarding_done && waStatus !== "conectado")) && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Conectar WhatsApp</CardTitle>
                    </div>
                    <CardDescription>
                      Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → Escaneie o QR code
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {waError && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{waError}</span>
                      </div>
                    )}

                    <div className="flex flex-col items-center gap-4">
                      {qrData || waInfo?.whatsapp_qr ? (
                        <div className="relative">
                          <div className="rounded-2xl border-4 border-[#25D366] p-3 bg-white shadow-lg">
                            <img
                              src={(() => {
                                const raw = qrData || waInfo?.whatsapp_qr || "";
                                return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
                              })()}
                              alt="QR Code WhatsApp"
                              className="w-56 h-56"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          </div>
                          {waStatus === "aguardando_qr" && (
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                              <Badge className="bg-[#25D366] text-white gap-1 shadow">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Aguardando leitura...
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <QrCode className="h-12 w-12 opacity-30" />
                          <p className="text-xs text-center px-4">Clique no botão abaixo para gerar o QR code</p>
                        </div>
                      )}

                      <Button
                        onClick={fetchQrCode}
                        disabled={loadingQr}
                        className="bg-[#25D366] hover:bg-[#22c55e] text-white gap-2 w-full max-w-xs"
                      >
                        {loadingQr
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando QR code...</>
                          : <><RefreshCw className="h-4 w-4" /> {qrData ? "Novo QR code" : "Gerar QR code"}</>}
                      </Button>
                    </div>

                    <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Como conectar</p>
                      {[
                        "Abra o WhatsApp no seu celular",
                        "Toque em ⋮ (3 pontos) → Dispositivos conectados",
                        "Toque em \"Conectar um dispositivo\"",
                        "Escaneie o QR code acima",
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center shrink-0 font-bold">
                            {i + 1}
                          </span>
                          {step}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Aba Usuários ─────────────────────────────────────────────────── */}
        {teamRole === "owner" && (
          <TabsContent value="usuarios" className="space-y-6">

            {/* Convidar */}
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Convidar usuário</CardTitle>
                </div>
                <CardDescription>O convidado receberá um e-mail para criar a senha e acessar o sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colaborador@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                    />
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="shrink-0">
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      {inviting ? "Enviando..." : "Convidar"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Abas permitidas</Label>
                  <div className="flex flex-wrap gap-2">
                    {abasDisponiveis.map(aba => (
                      <button
                        key={aba.key}
                        onClick={() => toggleInvitePerm(aba.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          invitePerms.includes(aba.key)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {aba.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de membros */}
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Equipe</CardTitle>
                </div>
                <CardDescription>Usuários com acesso ao painel</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário convidado ainda</p>
                ) : (
                  <div className="divide-y divide-border">
                    {members.map(member => (
                      <div key={member.id} className="py-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                              {(member.nome || member.email)[0].toUpperCase()}
                            </div>
                            <div>
                              {member.nome && <p className="text-sm font-medium">{member.nome}</p>}
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={member.status === "ativo" ? "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800"}>
                              {member.status === "ativo" ? "Ativo" : "Pendente"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-primary text-xs"
                              onClick={() => {
                                setEditingMember(editingMember === member.id ? null : member.id);
                                setEditPerms(member.permissoes);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {editingMember === member.id ? (
                          <div className="space-y-3 pl-12">
                            <div className="flex flex-wrap gap-2">
                              {abasDisponiveis.map(aba => (
                                <button
                                  key={aba.key}
                                  onClick={() => toggleEditPerm(aba.key)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                    editPerms.includes(aba.key)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-card text-muted-foreground border-border hover:border-primary/50"
                                  }`}
                                >
                                  {aba.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSavePerms(member.id)}>Salvar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingMember(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pl-12">
                            {member.permissoes.map(p => (
                              <span key={p} className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground">
                                {abasDisponiveis.find(a => a.key === p)?.label ?? p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
