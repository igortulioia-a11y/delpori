"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ShoppingCart, Plus, Minus, Trash2, Search, Loader2, UtensilsCrossed, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { normalizeSlug } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import type { Product } from "@/contexts/CartContext";

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

  const getItemQty = (id: string) => items.find(i => i.product.id === id)?.quantity ?? 0;

  const handleAdd = (product: Product) => {
    const isSpecial = dailySpecial && product.id === dailySpecial.product_id;
    const productToAdd = isSpecial ? { ...product, preco: dailySpecial.preco_promocional } : product;
    addItem(productToAdd);
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
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />
        <div className="relative z-10 max-w-lg mx-auto px-4 pt-8 pb-6">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{profile?.nome || "Cardápio"}</h1>
          <p className="text-white/70 text-sm mt-1">Peça pelo cardápio digital</p>
          <div className="relative mt-4">
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
                {qty === 0 ? (
                  <Button size="sm" variant="secondary" className="w-full h-9 rounded-full font-bold text-xs" onClick={() => handleAdd(sp)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ao carrinho
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-3 bg-white/20 rounded-full py-1 px-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-white hover:bg-white/20" onClick={() => updateQuantity(sp.id, qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-bold w-5 text-center">{qty}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-white hover:bg-white/20" onClick={() => handleAdd(sp)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
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
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{product.descricao}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {isSpecial ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground line-through">R$ {product.preco.toFixed(2).replace(".", ",")}</span>
                      <span className="font-extrabold text-base text-orange-500">R$ {dailySpecial.preco_promocional.toFixed(2).replace(".", ",")}</span>
                    </div>
                  ) : (
                    <span className="font-extrabold text-base text-primary">
                      R$ {product.preco.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {quantity === 0 ? (
                    <Button
                      size="sm"
                      className="h-9 px-4 text-xs rounded-full shadow-sm font-semibold"
                      onClick={() => handleAdd(product)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-secondary rounded-full px-1 py-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => updateQuantity(product.id, quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-5 text-center">{quantity}</span>
                      <Button size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAdd(product)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
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
                    {items.map(item => (
                      <div key={item.product.id} className="space-y-2">
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
                              <button onClick={() => removeItem(item.product.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 bg-secondary rounded-full px-1 py-0.5">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                                <Button size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="font-bold text-sm text-primary">
                                R$ {(item.product.preco * item.quantity).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Input
                          placeholder="Observação (ex: sem cebola)"
                          className="h-9 text-xs rounded-xl"
                          value={item.observation}
                          onChange={e => updateObservation(item.product.id, e.target.value)}
                        />
                        <Separator />
                      </div>
                    ))}
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
    </div>
  );
}

export default function MenuDigital() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <MenuDigitalInner />
    </Suspense>
  );
}
