"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, Truck, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/utils";
import { unitPriceWithOptions } from "@/lib/product-options";

interface DeliveryZone {
  id: string;
  nome: string;
  bairros: string[];
  taxa: number;
  tempo_estimado: number;
  ativo: boolean;
}

function MenuCheckoutInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const telParam = searchParams.get("tel") ?? "";

  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(telParam);
  const [payment, setPayment] = useState<string>("");
  const [isPickup, setIsPickup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [defaultTaxaEntrega, setDefaultTaxaEntrega] = useState<number | null>(null);
  const [enabledPayments, setEnabledPayments] = useState<string[]>([]);

  // Delivery zones
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  const [zoneError, setZoneError] = useState("");

  // Load delivery zones + WhatsApp phone
  useEffect(() => {
    async function loadData() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", normalizeSlug(slug))
        .single();

      if (!profile) return;

      const { data: zonesData } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("user_id", profile.id)
        .eq("ativo", true);

      setZones(zonesData || []);

      // Buscar telefone WhatsApp e taxa de entrega padrão do restaurante
      try {
        const res = await fetch(`/api/restaurant-phone?slug=${encodeURIComponent(normalizeSlug(slug))}`);
        if (res.ok) {
          const data = await res.json();
          setWhatsappPhone(data.phone);
          if (data.taxa_entrega != null) setDefaultTaxaEntrega(data.taxa_entrega);
          if (data.formas_pagamento) {
            setEnabledPayments(data.formas_pagamento.split(",").map((s: string) => s.trim()).filter(Boolean));
          }
        }
      } catch { /* silencioso */ }
    }
    loadData();
  }, [slug]);

  // Match zone when address changes
  useEffect(() => {
    if (isPickup || !address.trim() || zones.length === 0) {
      setMatchedZone(null);
      setZoneError("");
      return;
    }

    const lowerAddr = address.toLowerCase();
    const found = zones.find(z =>
      z.bairros.some(b => lowerAddr.includes(b.toLowerCase()))
    );

    if (found) {
      setMatchedZone(found);
      setZoneError("");
    } else {
      setMatchedZone(null);
      setZoneError("Não identificamos sua região de entrega. Verifique o endereço ou entre em contato.");
    }
  }, [address, zones, isPickup]);

  const deliveryFee = isPickup ? 0 : (matchedZone?.taxa ?? (zones.length === 0 ? (defaultTaxaEntrega ?? 0) : 0));
  const hasValidDelivery = isPickup || zones.length === 0 || !!matchedZone;
  const finalTotal = totalPrice + deliveryFee;

  const allPaymentOptions = [
    { label: "PIX", value: "pix" },
    { label: "Cartão de crédito", value: "credito" },
    { label: "Cartão de débito", value: "debito" },
    { label: "Dinheiro", value: "dinheiro" },
    { label: "Vale-refeição", value: "vale_refeicao" },
  ];
  const paymentOptions = enabledPayments.length > 0
    ? allPaymentOptions.filter(o => enabledPayments.includes(o.value))
    : allPaymentOptions.filter(o => o.value !== "vale_refeicao"); // fallback: 4 originais

  if (items.length === 0 && !confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Seu carrinho está vazio</p>
          <Button variant="outline" onClick={() => router.push(`/cardapio/${slug}`)}>
            Voltar ao cardápio
          </Button>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <MessageCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">Quase lá!</h2>
          <p className="text-muted-foreground text-sm">
            Você foi redirecionado para o WhatsApp com seu pedido. Envie a mensagem para confirmar!
          </p>
          <Button variant="outline" onClick={() => router.push(`/cardapio/${slug}`)}>
            Voltar ao cardápio
          </Button>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    if (!name.trim() || !phone.trim() || (!isPickup && !address.trim()) || !payment) return;
    if (!isPickup && zones.length > 0 && !matchedZone) return;
    if (!whatsappPhone) return;

    setLoading(true);
    setError("");

    try {
      // Montar mensagem do pedido
      const fmt = (v: number) => v.toFixed(2).replace(".", ",");

      const itensTexto = items
        .map(i => {
          const unit = unitPriceWithOptions(i.product.preco, i.selectedOptions);
          const lineTotal = unit * i.quantity;
          const lines = [`- ${i.quantity}x ${i.product.nome} (R$ ${fmt(lineTotal)})`];
          for (const s of i.selectedOptions) {
            const extra = (Number(s.preco_adicional) || 0) > 0 ? ` (+R$ ${fmt(s.preco_adicional)})` : "";
            lines.push(`  + ${s.nome}${extra}`);
          }
          if (i.observation) lines.push(`  _${i.observation}_`);
          return lines.join("\n");
        })
        .join("\n");

      const paymentLabel = paymentOptions.find(p => p.value === payment)?.label ?? payment;

      const mensagem = [
        `Ola! Fiz meu pedido pelo cardapio digital:`,
        ``,
        itensTexto,
        ``,
        !isPickup && deliveryFee > 0 ? `Taxa de entrega: R$ ${fmt(deliveryFee)}` : null,
        `Total: R$ ${fmt(finalTotal)}`,
        ``,
        `Nome: ${name.trim()}`,
        isPickup ? `Retirada no local` : `Endereco: ${address.trim()}`,
        `Pagamento: ${paymentLabel}`,
      ].filter(Boolean).join("\n");

      // Abrir WhatsApp com a mensagem
      const waUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(mensagem)}`;
      const popup = window.open(waUrl, "_blank");

      // Se popup foi bloqueado, NAO limpar carrinho — cliente perderia tudo
      if (!popup) {
        setError("Nao foi possivel abrir o WhatsApp. Verifique se popups estao bloqueados no seu navegador e tente novamente.");
        return;
      }

      clearCart();
      setConfirmed(true);
    } catch {
      setError("Erro ao redirecionar para o WhatsApp. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim() && phone.trim() && (isPickup || address.trim()) && payment && hasValidDelivery && !!whatsappPhone;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8"
            onClick={() => router.push(`/cardapio/${slug}${telParam ? `?tel=${encodeURIComponent(telParam)}` : ""}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">Finalizar Pedido</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-10">
        {/* Order summary */}
        <section>
          <h2 className="font-semibold text-sm mb-3">Resumo do pedido</h2>
          <div className="bg-card rounded-2xl border p-4 space-y-2">
            {items.map(item => {
              const unit = unitPriceWithOptions(item.product.preco, item.selectedOptions);
              return (
                <div key={item.cartItemId} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{item.quantity}x {item.product.nome}</span>
                    <span className="font-medium">R$ {(unit * item.quantity).toFixed(2).replace(".", ",")}</span>
                  </div>
                  {item.selectedOptions.map((s, idx) => (
                    <p key={idx} className="text-[11px] text-muted-foreground ml-3">
                      + {s.nome}{(Number(s.preco_adicional) || 0) > 0 && ` (+R$ ${Number(s.preco_adicional).toFixed(2).replace(".", ",")})`}
                    </p>
                  ))}
                  {item.observation && <p className="text-[11px] text-muted-foreground/70 ml-3">({item.observation})</p>}
                </div>
              );
            })}
            <Separator />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                {isPickup ? "Retirada no local" : "Taxa de entrega"}
              </span>
              <span className={`font-medium ${isPickup ? "text-primary" : ""}`}>
                {isPickup ? "Grátis" : deliveryFee > 0 ? `R$ ${deliveryFee.toFixed(2).replace(".", ",")}` : zones.length === 0 ? "Grátis" : "—"}
              </span>
            </div>
            {matchedZone && !isPickup && (
              <p className="text-xs text-muted-foreground">
                Região: {matchedZone.nome} — Tempo estimado: ~{matchedZone.tempo_estimado} min
              </p>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">R$ {finalTotal.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        </section>

        {/* Delivery toggle */}
        <section>
          <div className="flex items-center justify-between bg-card rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Retirar no local</p>
                <p className="text-xs text-muted-foreground">Sem taxa de entrega</p>
              </div>
            </div>
            <Switch checked={isPickup} onCheckedChange={setIsPickup} />
          </div>
        </section>

        {/* Delivery info */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Dados {isPickup ? "do pedido" : "de entrega"}</h2>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Nome</Label>
            <Input
              id="name"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-green-500" />
              WhatsApp para confirmar o pedido
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 91234-5678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="rounded-xl"
              readOnly={!!telParam}
            />
            {telParam && (
              <p className="text-[11px] text-muted-foreground">
                Confirmação será enviada para esse número via WhatsApp.
              </p>
            )}
          </div>

          {!isPickup && (
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs">Endereço de entrega</Label>
              <Input
                id="address"
                placeholder="Rua, número, bairro"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="rounded-xl"
              />
              {zoneError && address.trim() && (
                <p className="text-xs text-amber-600">{zoneError}</p>
              )}
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Forma de pagamento</h2>
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPayment(opt.value)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  payment === opt.value
                    ? "border-primary bg-accent text-accent-foreground shadow-sm"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!whatsappPhone && (
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-3">
            WhatsApp do restaurante indisponível no momento. Tente novamente mais tarde.
          </div>
        )}

        <Button
          className="w-full h-13 rounded-2xl text-sm font-bold shadow-lg"
          disabled={!isValid || loading}
          onClick={handleConfirm}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecionando...</>
          ) : (
            <>
              <MessageCircle className="mr-2 h-4 w-4" />
              Enviar pedido via WhatsApp — R$ {finalTotal.toFixed(2).replace(".", ",")}
            </>
          )}
        </Button>
      </main>
    </div>
  );
}

export default function MenuCheckout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>}>
      <MenuCheckoutInner />
    </Suspense>
  );
}
