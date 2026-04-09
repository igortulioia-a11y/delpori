"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Loader2, UtensilsCrossed, Upload, X, Download, GripVertical, ArrowUpDown } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImportMenuDialog } from "@/components/ImportMenuDialog";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  imagem_url: string;
  disponivel: boolean;
  ordem: number;
}

function SortableProduct({ product, onEdit, onDelete, onToggle }: { product: Product; onEdit: (p: Product) => void; onDelete: (id: string) => void; onToggle: (p: Product) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card border rounded-xl shadow-sm">
      <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </button>
      {product.imagem_url ? (
        <img src={product.imagem_url} alt={product.nome} className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="h-5 w-5 text-primary/40" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{product.nome}</p>
        <p className="text-xs text-muted-foreground">{product.categoria} · R$ {product.preco.toFixed(2).replace(".", ",")}</p>
      </div>
      <Switch checked={product.disponivel} onCheckedChange={() => onToggle(product)} />
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [catFilter, setCatFilter] = useState("Todos");
  const [newCategory, setNewCategory] = useState("");
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [imageCropSrc, setImageCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));

  // Categorias: apenas dos produtos existentes + customizadas pelo usuário
  const allCats = Array.from(new Set([
    ...products.map(p => p.categoria).filter(Boolean),
    ...customCategories,
  ])).sort();
  const categorias = ["Todos", ...allCats];

  const [form, setForm] = useState({
    nome: "", descricao: "", preco: "", categoria: "", imagem: "",
  });

  // Load products from Supabase
  const loadProducts = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive" });
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, [user?.id]);

  const filtered = catFilter === "Todos" ? products : products.filter((p) => p.categoria === catFilter);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Posicoes no array global (nao no filtrado) pra garantir que a reordenacao
    // reflita no state e no `filtered` derivado via .filter() (que preserva ordem).
    const oldIndex = products.findIndex(p => p.id === active.id);
    const newIndex = products.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const moved = arrayMove(products, oldIndex, newIndex);
    // Recalcula `ordem` por categoria com base nas novas posicoes.
    const catCounters: Record<string, number> = {};
    const withOrder = moved.map(p => {
      const cat = p.categoria || "";
      const idx = catCounters[cat] ?? 0;
      catCounters[cat] = idx + 1;
      return { ...p, ordem: idx };
    });
    setProducts(withOrder);
  };

  const saveOrder = async () => {
    if (!user) return;
    setSavingOrder(true);
    const updates = products.map((p, i) => ({ id: p.id, ordem: p.ordem ?? i }));
    const results = await Promise.all(
      updates.map(u =>
        supabase.from("products").update({ ordem: u.ordem }).eq("id", u.id).eq("user_id", user.id)
      )
    );
    setSavingOrder(false);
    const firstError = results.find(r => r.error);
    if (firstError?.error) {
      toast({ title: "Erro ao salvar ordem", description: firstError.error.message, variant: "destructive" });
      return;
    }
    setSortMode(false);
    toast({ title: "Ordem salva!" });
  };

  // Abre o dialog de crop quando o usuario seleciona o arquivo
  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    setImageCropSrc(url);
  };

  // Chamado pelo ImageCropDialog com o Blob JPEG recortado
  const handleImageCropComplete = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      toast({ title: "Erro ao enviar imagem", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm(f => ({ ...f, imagem: data.publicUrl }));
      toast({ title: "Imagem enviada!" });
    }
    setUploading(false);
  };

  // Limpa o object URL quando o dialog de crop fecha
  const handleImageCropOpenChange = (open: boolean) => {
    if (!open && imageCropSrc) {
      URL.revokeObjectURL(imageCropSrc);
      setImageCropSrc(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", descricao: "", preco: "", categoria: "Hambúrgueres", imagem: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ nome: p.nome, descricao: p.descricao, preco: p.preco.toString(), categoria: p.categoria, imagem: p.imagem_url });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome || !form.preco || !user) return;
    setSaving(true);

    const productData = {
      nome: form.nome,
      descricao: form.descricao,
      preco: parseFloat(form.preco),
      categoria: form.categoria,
      imagem_url: form.imagem || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop",
      user_id: user.id,
    };

    if (editing) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editing.id)
        .eq("user_id", user.id);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto atualizado!" });
        await loadProducts();
      }
    } else {
      const { error } = await supabase
        .from("products")
        .insert({ ...productData, disponivel: true });

      if (error) {
        toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Produto criado!" });
        await loadProducts();
      }
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const toggleActive = async (product: Product) => {
    if (!user) return;
    const newDisponivel = !product.disponivel;
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, disponivel: newDisponivel } : p));

    const { error } = await supabase
      .from("products")
      .update({ disponivel: newDisponivel })
      .eq("id", product.id)
      .eq("user_id", user.id);

    if (error) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, disponivel: product.disponivel } : p));
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setProducts(prev => prev.filter(p => p.id !== id));
      if (detailProduct?.id === id) setDetailProduct(null);
      toast({ title: "Produto excluído" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cardápio</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os itens do seu delivery</p>
        </div>
        <div className="flex items-center gap-2">
          {sortMode ? (
            <>
              <Button variant="outline" onClick={() => { setSortMode(false); loadProducts(); }}>Cancelar</Button>
              <Button onClick={saveOrder} disabled={savingOrder} className="gap-2">
                {savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
                {savingOrder ? "Salvando..." : "Salvar ordem"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setSortMode(true)} className="gap-2">
                <ArrowUpDown className="h-4 w-4" /> <span className="hidden sm:inline">Ordenar</span>
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Importar UaiRango</span><span className="sm:hidden">Importar</span>
              </Button>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar produto</span><span className="sm:hidden">Adicionar</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Category filter + manage */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              catFilter === cat
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setCatDialogOpen(true)}
          className="px-2 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors flex items-center gap-0.5"
        >
          <Plus className="h-3 w-3" /> Categoria
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
          <p className="text-sm">Nenhum produto encontrado</p>
          <Button variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar primeiro produto
          </Button>
        </div>
      )}

      {/* Grid ou Sort Mode */}
      {sortMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 max-w-xl">
              {filtered.map(p => (
                <SortableProduct key={p.id} product={p} onEdit={openEdit} onDelete={deleteProduct} onToggle={toggleActive} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className={`shadow-sm overflow-hidden transition-shadow hover:shadow-md group cursor-pointer ${!p.disponivel ? "opacity-60" : ""}`}
              onClick={() => setDetailProduct(p)}
            >
              <div className="relative h-40 overflow-hidden bg-secondary">
                {p.imagem_url ? (
                  <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5">
                    <UtensilsCrossed className="h-12 w-12 text-primary/40" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7 hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="secondary" className="text-[10px] font-medium">{p.categoria}</Badge>
                  <Switch
                    checked={p.disponivel}
                    onCheckedChange={() => toggleActive(p)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <h3 className="font-semibold text-sm">{p.nome}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descricao}</p>
                <p className="text-base font-bold mt-2 tabular-nums text-primary">R$ {p.preco.toFixed(2).replace(".", ",")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product detail sheet */}
      <Sheet open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <SheetContent className="sm:max-w-md">
          {detailProduct && (
            <>
              <SheetHeader>
                <SheetTitle>{detailProduct.nome}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg overflow-hidden bg-secondary">
                  {detailProduct.imagem_url ? (
                    <img src={detailProduct.imagem_url} alt={detailProduct.nome} className="w-full h-56 object-cover" />
                  ) : (
                    <div className="w-full h-56 flex items-center justify-center bg-primary/5">
                      <UtensilsCrossed className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{detailProduct.categoria}</Badge>
                  <Badge variant={detailProduct.disponivel ? "default" : "outline"}>
                    {detailProduct.disponivel ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm">{detailProduct.descricao}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preço</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">R$ {detailProduct.preco.toFixed(2).replace(".", ",")}</p>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { openEdit(detailProduct); setDetailProduct(null); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button
                    variant={detailProduct.disponivel ? "outline" : "default"}
                    onClick={() => {
                      toggleActive(detailProduct);
                      setDetailProduct({ ...detailProduct, disponivel: !detailProduct.disponivel });
                    }}
                  >
                    {detailProduct.disponivel ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do produto" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do produto" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {allCats.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagem do produto</Label>
              {/* Preview */}
              {form.imagem && (
                <div className="relative rounded-lg overflow-hidden bg-secondary h-36 mb-2">
                  <img src={form.imagem} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, imagem: "" }))}
                    className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* Upload / Generate buttons */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando..." : "Upload de foto"}
                </Button>
              </div>
              {/* URL manual fallback */}
              <Input
                value={form.imagem}
                onChange={(e) => setForm({ ...form, imagem: e.target.value })}
                placeholder="Ou cole uma URL de imagem..."
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de categorias */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Nome da nova categoria..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatInput.trim()) {
                    const name = newCatInput.trim();
                    if (!allCats.includes(name)) {
                      setCustomCategories(prev => [...prev, name]);
                    }
                    setNewCatInput("");
                  }
                }}
              />
              <Button onClick={() => {
                const name = newCatInput.trim();
                if (name && !allCats.includes(name)) {
                  setCustomCategories(prev => [...prev, name]);
                }
                setNewCatInput("");
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {allCats.map(cat => {
                const count = products.filter(p => p.categoria === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat}</span>
                      <span className="text-xs text-muted-foreground">({count} produto{count !== 1 ? "s" : ""})</span>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (count > 0 && !confirm(`Excluir categoria "${cat}"? Os ${count} produto(s) ficarão sem categoria.`)) return;
                        if (count > 0) {
                          await supabase
                            .from("products")
                            .update({ categoria: null })
                            .eq("user_id", user?.id)
                            .eq("categoria", cat);
                          await loadProducts();
                        }
                        setCustomCategories(prev => prev.filter(c => c !== cat));
                        toast({ title: `Categoria "${cat}" excluída` });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import UaiRango Dialog */}
      <ImportMenuDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={loadProducts}
      />

      {/* Crop Dialog para imagem do produto */}
      <ImageCropDialog
        open={!!imageCropSrc}
        onOpenChange={handleImageCropOpenChange}
        imageSrc={imageCropSrc}
        aspect={1}
        title="Ajustar foto do produto"
        onCropComplete={handleImageCropComplete}
      />
    </div>
  );
}
