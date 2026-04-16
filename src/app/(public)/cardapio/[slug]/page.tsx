"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ShoppingCart, Plus, Minus, Trash2, Search, Loader2, UtensilsCrossed, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import type { Product } from "@/contexts/CartContext";
import {
  groupProductOptions,
  unitPriceWithOptions,
  type ProductOption,
  type ProductOptionGroup,
  type SelectedOption,
} from "@/lib/product-options";

interface ProfileData {
  id: string;
  nome: string | null;
  logo_url: string | null;
  tipo_estabelecimento: string | null;
  telefone: string | null;
}

function MenuDigitalInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const tel = searchParams.get("tel") ?? "";
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const { items, addItem, removeItem, updateQuantity, updateObservation, totalItems, totalPrice } = useCart();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<string[]>(["Todos"]);
  const [dailySpecial, setDailySpecial] = useState<{ product_id: string; preco_promocional: number } | null>(null);
  const [productsWithOptions, setProductsWithOptions] = useState<Set<string>>(new Set());
  const [optsProduct, setOptsProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, nome, logo_url, tipo_estabelecimento, telefone")
        .eq("slug", normalizeSlug(slug))
        .eq("ativo", true)
        .single();

      if (profileError || !profileData) {
        setError("Restaurante não encontrado");
        setLoading(false);
        return;
      }
      setProfile(profileData);

      const { data: produtosData } = await supabase
        .from("products")
        .select("id, nome, descricao, preco, categoria, imagem_url, disponivel")
        .eq("user_id", profileData.id)
        .eq("disponivel", true)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: false });

      const prods: Product[] = (produtosData || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao || "",
        preco: p.preco,
        categoria: p.categoria || "Outros",
        imagem_url: p.imagem_url || "",
        disponivel: p.disponivel,
      }));
      setProdutos(prods);

      const cats = ["Todos", ...new Set(prods.map(p => p.categoria).filter(Boolean))];
      setCategorias(cats);

      // Produtos que tem opcoes disponiveis
      if (prods.length > 0) {
        const { data: optRows } = await supabase
          .from("product_options")
          .select("product_id")
          .eq("disponivel", true)
          .in("product_id", prods.map(p => p.id));
        const withOpts = new Set<string>(
          ((optRows || []) as Array<{ product_id: string | null }>)
            .map(r => r.product_id)
            .filter((v): v is string => !!v)
        );
        setProductsWithOptions(withOpts);
      } else {
        setProductsWithOptions(new Set());
      }

      // Prato do dia
      const today = new Date().getDay();
      const { data: specialData } = await supabase
        .from("daily_specials")
        .select("product_id, preco_promocional")
        .eq("user_id", profileData.id)
        .eq("dia_semana", today)
        .eq("ativo", true)
        .maybeSingle();
      if (specialData) {
        setDailySpecial({ product_id: specialData.product_id, preco_promocional: Number(specialData.preco_promocional) });
      }

      setLoading(false);
    }
    loadData();
  }, [slug]);

  const filtered = produtos
    .filter(p => activeCategory === "Todos" || p.categoria === activeCategory)
    .filter(p => !searchQuery || p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || (p.descricao || "").toLowerCase().includes(searchQuery.toLowerCase()));

  // Soma todas as linhas do carrinho deste produto (podem existir varias com opcoes diferentes)
  const getItemQty = (id: string) =>
    items.filter(i => i.product.id === id).reduce((sum, i) => sum + i.quantity, 0);

  // Encontra a linha unica no carrinho (uso do stepper +/- no card de produto sem opcoes)
  const getSingleCartItemId = (id: string) => {
    const matches = items.filter(i => i.product.id === id);
    return matches.length === 1 ? matches[0].cartItemId : null;
  };

  const handleAdd = (product: Product) => {
    const isSpecial = dailySpecial && product.id === dailySpecial.product_id;
    const productToAdd = isSpecial ? { ...product, preco: dailySpecial.preco_promocional } : product;

    if (productsWithOptions.has(product.id)) {
      setOptsProduct(productToAdd);
      return;
    }

    addItem(productToAdd, []);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 300);
  };

  const goToCheckout = () => {
    const checkoutUrl = `/cardapio/${slug}/checkout${tel ? `?tel=${encodeURIComponent(tel)}` : ""}`;
    router.push(checkoutUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>
        <div className="relative z-10 max-w-lg mx-auto px-4 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-3">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt={profile.nome || ""} className="w-14 h-14 rounded-2xl object-cover bg-white/20 shadow-lg ring-2 ring-white/30" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg ring-2 ring-white/30">
                <UtensilsCrossed className="h-7 w-7 text-white/80" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{profile?.nome || "Cardápio"}</h1>
              <p className="text-white/70 text-sm">Peça pelo cardápio digital</p>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              type="text"
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="w-full overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
            <div className="flex gap-2 px-4 py-3 w-max">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">
        {/* Banner Prato do Dia */}
        {dailySpecial && (() => {
          const sp = produtos.find(p => p.id === dailySpecial.product_id);
          if (!sp) return null;
          const qty = getItemQty(sp.id);
          const hasOptions = productsWithOptions.has(sp.id);
          const singleCartId = getSingleCartItemId(sp.id);
          const stepperAvailable = !hasOptions && singleCartId !== null;
          return (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 shadow-lg text-white">
              <div className="flex gap-4 items-center">
                {sp.imagem_url ? (
                  <img src={sp.imagem_url} alt={sp.nome} className="w-20 h-20 rounded-xl object-cover shadow-md" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-white/70" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Promoção do Dia</span>
                  </div>
                  <h3 className="font-extrabold text-base leading-tight">{sp.nome}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/70 line-through text-sm">R$ {sp.preco.toFixed(2).replace(".", ",")}</span>
                    <span className="font-extrabold text-lg">R$ {dailySpecial.preco_promocional.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                {stepperAvailable && qty > 0 ? (
                  <div className="flex items-center justify-center gap-3 bg-white/20 rounded-full py-1 px-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-white hover:bg-white/20" onClick={() => updateQuantity(singleCartId!, qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-bold w-5 text-center">{qty}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-white hover:bg-white/20" onClick={() => handleAdd(sp)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" className="w-full h-9 rounded-full font-bold text-xs" onClick={() => handleAdd(sp)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {qty > 0 ? `No carrinho (${qty}) · Adicionar outra` : "Adicionar ao carrinho"}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum produto encontrado
          </div>
        )}
        {filtered.map(product => {
          const quantity = getItemQty(product.id);
          const isAdding = addedId === product.id;
          const isSpecial = dailySpecial?.product_id === product.id;
          const hasOptions = productsWithOptions.has(product.id);
          const singleCartId = getSingleCartItemId(product.id);
          const stepperAvailable = !hasOptions && singleCartId !== null;
          return (
            <div
              key={product.id}
              className={`flex gap-4 bg-card rounded-2xl border p-3 shadow-sm hover:shadow-md transition-all duration-200 ${isAdding ? "scale-[1.02]" : ""} ${isSpecial ? "ring-2 ring-orange-400/50" : ""}`}
            >
              <div className="relative shrink-0">
                {product.imagem_url ? (
                  <img
                    src={product.imagem_url}
                    alt={product.nome}
                    className="w-28 h-28 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-primary/5 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-primary/40" />
                  </div>
                )}
                {isSpecial ? (
                  <Badge className="absolute -top-1.5 -left-1.5 text-[10px] px-1.5 py-0.5 shadow-sm bg-orange-500 hover:bg-orange-500 text-white">
                    <Sparkles className="h-3 w-3 mr-0.5" />Promo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="absolute -top-1.5 -left-1.5 text-[10px] px-1.5 py-0.5 shadow-sm">
                    {product.categoria}
                  </Badge>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm leading-tight">{product.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{product.descricao}</p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  {isSpecial ? (
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-[11px] text-muted-foreground line-through whitespace-nowrap">R$ {product.preco.toFixed(2).replace(".", ",")}</span>
                      <span className="font-extrabold text-base text-orange-500 whitespace-nowrap">R$ {dailySpecial.preco_promocional.toFixed(2).replace(".", ",")}</span>
                    </div>
                  ) : (
                    <span className="font-extrabold text-base text-primary whitespace-nowrap">
                      R$ {product.preco.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {stepperAvailable && quantity > 0 ? (
                    <div className="flex items-center gap-2.5 bg-secondary rounded-full px-1 py-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => updateQuantity(singleCartId!, quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-5 text-center">{quantity}</span>
                      <Button size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAdd(product)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-9 px-4 text-xs rounded-full shadow-sm font-semibold shrink-0"
                      onClick={() => handleAdd(product)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {hasOptions && quantity > 0 ? `No carrinho (${quantity})` : "Adicionar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-2xl">
          <div className="max-w-lg mx-auto p-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full h-14 rounded-2xl text-sm font-bold justify-between px-5 shadow-lg">
                  <span className="flex items-center gap-2.5">
                    <ShoppingCart className="h-5 w-5" />
                    Ver carrinho
                    <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground font-bold">
                      {totalItems}
                    </Badge>
                  </span>
                  <span className="text-base">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl flex flex-col">
                <SheetHeader>
                  <SheetTitle className="text-lg">Seu Carrinho</SheetTitle>
                </SheetHeader>
                <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-2">
                  <div className="space-y-4">
                    {items.map(item => {
                      const unit = unitPriceWithOptions(item.product.preco, item.selectedOptions);
                      return (
                        <div key={item.cartItemId} className="space-y-2">
                          <div className="flex gap-3">
                            {item.product.imagem_url ? (
                              <img src={item.product.imagem_url} alt={item.product.nome} className="w-16 h-16 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                                <UtensilsCrossed className="h-8 w-8 text-primary/40" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-sm">{item.product.nome}</h4>
                                <button onClick={() => removeItem(item.cartItemId)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              {item.selectedOptions.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {item.selectedOptions.map((s, idx) => (
                                    <li key={`${item.cartItemId}-opt-${idx}`} className="text-[11px] text-muted-foreground leading-snug">
                                      + {s.nome}
                                      {s.preco_adicional > 0 && ` (+R$ ${s.preco_adicional.toFixed(2).replace(".", ",")})`}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 bg-secondary rounded-full px-1 py-0.5">
                                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}>
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                                  <Button size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                                <span className="font-bold text-sm text-primary">
                                  R$ {(unit * item.quantity).toFixed(2).replace(".", ",")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Input
                            placeholder="Observação (ex: sem cebola)"
                            className="h-9 text-xs rounded-xl"
                            value={item.observation}
                            onChange={e => updateObservation(item.cartItemId, e.target.value)}
                          />
                          <Separator />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t pt-4 mt-3 pb-6 space-y-3 shrink-0">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <Button
                    className="w-full h-13 rounded-2xl text-sm font-bold shadow-lg"
                    onClick={goToCheckout}
                  >
                    Finalizar pedido
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
      {/* Sheet de opcoes ao clicar "Adicionar" num produto que tem opcoes */}
      <Sheet open={!!optsProduct} onOpenChange={(open) => !open && setOptsProduct(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl flex flex-col">
          {optsProduct && (
            <ProductOptionsSheetInner
              product={optsProduct}
              onClose={() => setOptsProduct(null)}
              onConfirm={(selected, qty) => {
                for (let i = 0; i < qty; i++) addItem(optsProduct, selected);
                setOptsProduct(null);
                setAddedId(optsProduct.id);
                setTimeout(() => setAddedId(null), 300);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Componente inline: painel de selecao de opcoes/adicionais para o cardapio publico
function ProductOptionsSheetInner({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (selected: SelectedOption[], qty: number) => void;
}) {
  const [groups, setGroups] = useState<ProductOptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, SelectedOption[]>>({});
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("product_options")
      .select("*")
      .eq("product_id", product.id)
      .eq("disponivel", true)
      .order("grupo", { ascending: true })
      .order("criado_em", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setGroups(groupProductOptions((data || []) as ProductOption[]));
        setSelected({});
        setQty(1);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [product.id]);

  function toggleOption(group: ProductOptionGroup, option: ProductOption) {
    setSelected(prev => {
      const picks = prev[group.grupo] || [];
      const so: SelectedOption = { grupo: group.grupo, nome: option.nome, preco_adicional: Number(option.preco_adicional) || 0 };

      if (group.max_escolhas === 1) {
        // Radio: substituir
        const alreadySelected = picks.some(p => p.nome === option.nome);
        return { ...prev, [group.grupo]: alreadySelected ? [] : [so] };
      }

      // Checkbox: toggle com limite
      const idx = picks.findIndex(p => p.nome === option.nome);
      if (idx >= 0) {
        return { ...prev, [group.grupo]: picks.filter((_, i) => i !== idx) };
      }
      if (picks.length >= group.max_escolhas) return prev; // limite
      return { ...prev, [group.grupo]: [...picks, so] };
    });
  }

  function isOptionSelected(grupo: string, nome: string): boolean {
    return (selected[grupo] || []).some(s => s.nome === nome);
  }

  const isValid = groups.every(g => {
    const picks = selected[g.grupo] || [];
    return picks.length >= (g.min_escolhas ?? 0);
  });

  const flatSelected = groups.flatMap(g => selected[g.grupo] || []);
  const unit = unitPriceWithOptions(product.preco, flatSelected);
  const total = unit * qty;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg">{product.nome}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1">
        {/* Imagem + descricao */}
        <div className="flex gap-3 mb-4">
          {product.imagem_url ? (
            <img src={product.imagem_url} alt={product.nome} className="w-20 h-20 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="h-8 w-8 text-primary/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{product.descricao}</p>
            <p className="font-extrabold text-base text-primary mt-1">R$ {product.preco.toFixed(2).replace(".", ",")}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const picks = selected[group.grupo] || [];
              const atMax = picks.length >= group.max_escolhas;
              return (
                <div key={group.grupo}>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-sm">{group.grupo}</h4>
                    {group.min_escolhas >= 1 ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Obrigatório
                      </Badge>
                    ) : group.max_escolhas > 1 ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Até {group.max_escolhas}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    {group.options.map(opt => {
                      const sel = isOptionSelected(group.grupo, opt.nome);
                      const disabled = !sel && atMax;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleOption(group, opt)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                            sel
                              ? "border-primary bg-accent text-accent-foreground"
                              : disabled
                                ? "border-border opacity-40 cursor-not-allowed"
                                : "border-border hover:border-primary/30"
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`w-4 h-4 rounded-${group.max_escolhas === 1 ? "full" : "md"} border-2 flex items-center justify-center ${
                              sel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                            }`}>
                              {sel && <Check className="h-2.5 w-2.5" />}
                            </span>
                            {opt.nome}
                          </span>
                          {(Number(opt.preco_adicional) || 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              + R$ {Number(opt.preco_adicional).toFixed(2).replace(".", ",")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: quantidade + adicionar */}
      <div className="border-t pt-4 mt-3 pb-6 space-y-3 shrink-0">
        <div className="flex items-center justify-center gap-4">
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={() => setQty(q => Math.max(1, q - 1))}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="text-lg font-bold w-6 text-center">{qty}</span>
          <Button size="icon" className="h-9 w-9 rounded-full" onClick={() => setQty(q => q + 1)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          className="w-full h-13 rounded-2xl text-sm font-bold shadow-lg"
          disabled={!isValid}
          onClick={() => onConfirm(flatSelected, qty)}
        >
          Adicionar ao carrinho — R$ {total.toFixed(2).replace(".", ",")}
        </Button>
      </div>
    </>
  );
}

export default function MenuDigital() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <MenuDigitalInner />
    </Suspense>
  );
}
