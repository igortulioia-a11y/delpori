"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import type { ProductOption } from "@/lib/product-options";
import { groupProductOptions } from "@/lib/product-options";

interface DraftOption {
  key: string; // uuid local pra React key + reconciliacao
  id: string | null; // null = row nova (INSERT); string = row existente (UPDATE)
  nome: string;
  preco_adicional: number;
  disponivel: boolean;
  deleted: boolean; // tombstone — so efetivado no save
}

interface DraftGroup {
  key: string;
  originalName: string | null; // null = grupo novo
  name: string;
  min_escolhas: number;
  max_escolhas: number;
  options: DraftOption[];
}

interface ProductLite {
  id: string;
  nome: string;
}

interface ProductOptionsManagerProps {
  product: ProductLite;
  userId: string;
  onClose: () => void;
}

function genKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ProductOptionsManager({ product, userId, onClose }: ProductOptionsManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  // Guarda a lista de grupos carregados do banco no load — pra detectar grupos removidos
  const [loadedGroupNames, setLoadedGroupNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("product_options")
        .select("*")
        .eq("product_id", product.id)
        .order("grupo", { ascending: true })
        .order("criado_em", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: "Erro ao carregar opções", description: error.message, variant: "destructive" });
        setGroups([]);
        setLoadedGroupNames([]);
        setLoading(false);
        return;
      }
      const rows = (data || []) as ProductOption[];
      // groupProductOptions filtra disponivel=false — aqui queremos TODOS (disponivel pode ser editado)
      const map = new Map<string, DraftGroup>();
      for (const row of rows) {
        const g = map.get(row.grupo);
        const opt: DraftOption = {
          key: genKey(),
          id: row.id,
          nome: row.nome,
          preco_adicional: Number(row.preco_adicional) || 0,
          disponivel: row.disponivel,
          deleted: false,
        };
        if (g) {
          g.options.push(opt);
        } else {
          map.set(row.grupo, {
            key: genKey(),
            originalName: row.grupo,
            name: row.grupo,
            min_escolhas: row.min_escolhas ?? 0,
            max_escolhas: row.max_escolhas ?? 1,
            options: [opt],
          });
        }
      }
      const draft = Array.from(map.values());
      setGroups(draft);
      setLoadedGroupNames(draft.map(g => g.originalName!).filter(Boolean));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [product.id]);

  function addGroup() {
    setGroups(prev => [
      ...prev,
      {
        key: genKey(),
        originalName: null,
        name: "",
        min_escolhas: 0,
        max_escolhas: 1,
        options: [],
      },
    ]);
  }

  function updateGroup(key: string, patch: Partial<DraftGroup>) {
    setGroups(prev => prev.map(g => (g.key === key ? { ...g, ...patch } : g)));
  }

  function removeGroup(key: string) {
    setGroups(prev => prev.filter(g => g.key !== key));
  }

  function addOption(groupKey: string) {
    setGroups(prev =>
      prev.map(g =>
        g.key === groupKey
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  key: genKey(),
                  id: null,
                  nome: "",
                  preco_adicional: 0,
                  disponivel: true,
                  deleted: false,
                },
              ],
            }
          : g
      )
    );
  }

  function updateOption(groupKey: string, optKey: string, patch: Partial<DraftOption>) {
    setGroups(prev =>
      prev.map(g =>
        g.key === groupKey
          ? { ...g, options: g.options.map(o => (o.key === optKey ? { ...o, ...patch } : o)) }
          : g
      )
    );
  }

  function removeOption(groupKey: string, optKey: string) {
    setGroups(prev =>
      prev.map(g =>
        g.key === groupKey
          ? {
              ...g,
              options: g.options
                .map(o =>
                  o.key === optKey
                    ? o.id
                      ? { ...o, deleted: true } // existente: tombstone
                      : { ...o, deleted: true } // nova: marca pra filtrar no render
                    : o
                )
                .filter(o => o.id || !o.deleted), // remove rows novas sem id
            }
          : g
      )
    );
  }

  function validate(): string | null {
    for (const g of groups) {
      if (!g.name.trim()) return "Todo grupo precisa de um nome.";
      if (g.min_escolhas < 0 || g.max_escolhas < 1) return `Grupo "${g.name}": min >= 0 e max >= 1.`;
      if (g.min_escolhas > g.max_escolhas) return `Grupo "${g.name}": min nao pode ser maior que max.`;
      const activeOpts = g.options.filter(o => !o.deleted);
      if (activeOpts.length === 0) return `Grupo "${g.name}" precisa de ao menos uma opção.`;
      for (const o of activeOpts) {
        if (!o.nome.trim()) return `Grupo "${g.name}" tem opção sem nome.`;
        if (o.preco_adicional < 0) return `Grupo "${g.name}" > "${o.nome}": preço não pode ser negativo.`;
      }
      // nomes unicos dentro do grupo
      const names = activeOpts.map(o => o.nome.trim().toLowerCase());
      if (new Set(names).size !== names.length) return `Grupo "${g.name}" tem opções com nomes repetidos.`;
    }
    // Nomes de grupo unicos
    const gnames = groups.map(g => g.name.trim().toLowerCase());
    if (new Set(gnames).size !== gnames.length) return "Existem grupos com o mesmo nome.";
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) {
      toast({ title: "Revise os dados", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Renomear grupos: atualiza TODAS as rows existentes do grupo antigo pro novo nome.
      //    Isso pega tambem rows que nao estao no draft (caso improvavel de drift).
      const renames: Array<{ from: string; to: string }> = [];
      for (const g of groups) {
        if (g.originalName && g.originalName !== g.name) {
          renames.push({ from: g.originalName, to: g.name });
        }
      }
      for (const r of renames) {
        const { error } = await supabase
          .from("product_options")
          .update({ grupo: r.to })
          .eq("user_id", userId)
          .eq("product_id", product.id)
          .eq("grupo", r.from);
        if (error) throw error;
      }

      // 2. Grupos inteiros removidos (estavam no load, nao estao mais no draft):
      const currentOriginalNames = new Set(
        groups.map(g => g.originalName).filter((n): n is string => !!n)
      );
      const renamedFromSet = new Set(renames.map(r => r.from));
      const toDropGroups = loadedGroupNames.filter(
        n => !currentOriginalNames.has(n) && !renamedFromSet.has(n)
      );
      for (const groupName of toDropGroups) {
        const { error } = await supabase
          .from("product_options")
          .delete()
          .eq("user_id", userId)
          .eq("product_id", product.id)
          .eq("grupo", groupName);
        if (error) throw error;
      }

      // 3. Para cada grupo do draft, processar options:
      for (const g of groups) {
        for (const opt of g.options) {
          if (opt.deleted && opt.id) {
            // existente marcado pra delete
            const { error } = await supabase
              .from("product_options")
              .delete()
              .eq("id", opt.id)
              .eq("user_id", userId);
            if (error) throw error;
          } else if (opt.id && !opt.deleted) {
            // UPDATE (inclui normalizacao de min/max/grupo)
            const { error } = await supabase
              .from("product_options")
              .update({
                grupo: g.name.trim(),
                nome: opt.nome.trim(),
                preco_adicional: Number(opt.preco_adicional) || 0,
                disponivel: opt.disponivel,
                min_escolhas: g.min_escolhas,
                max_escolhas: g.max_escolhas,
              })
              .eq("id", opt.id)
              .eq("user_id", userId);
            if (error) throw error;
          } else if (!opt.id && !opt.deleted) {
            // INSERT
            const { error } = await supabase.from("product_options").insert({
              user_id: userId,
              product_id: product.id,
              grupo: g.name.trim(),
              nome: opt.nome.trim(),
              preco_adicional: Number(opt.preco_adicional) || 0,
              disponivel: opt.disponivel,
              min_escolhas: g.min_escolhas,
              max_escolhas: g.max_escolhas,
            });
            if (error) throw error;
          }
        }
      }

      toast({ title: "Opções salvas", description: `Opções de "${product.nome}" atualizadas.` });
      onClose();
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <ListPlus className="h-5 w-5" />
          Opções de &ldquo;{product.nome}&rdquo;
        </SheetTitle>
        <SheetDescription>
          Crie grupos (ex: Tamanho, Adicionais) e as opções de cada grupo. Defina mínimo e máximo de escolhas.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {groups.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum grupo de opções ainda.
              </div>
            )}

            {groups.map(group => {
              const visibleOptions = group.options.filter(o => !o.deleted);
              return (
                <div key={group.key} className="rounded-xl border p-3 space-y-3 bg-card">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Nome do grupo (ex: Tamanho)"
                        value={group.name}
                        onChange={e => updateGroup(group.key, { name: e.target.value })}
                        className="font-medium"
                      />
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Mín.</span>
                          <Input
                            type="number"
                            min={0}
                            value={group.min_escolhas}
                            onChange={e =>
                              updateGroup(group.key, {
                                min_escolhas: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="h-8 w-14"
                          />
                        </label>
                        <label className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Máx.</span>
                          <Input
                            type="number"
                            min={1}
                            value={group.max_escolhas}
                            onChange={e =>
                              updateGroup(group.key, {
                                max_escolhas: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="h-8 w-14"
                          />
                        </label>
                        <span className="text-muted-foreground">
                          {group.min_escolhas >= 1 ? "Obrigatório" : "Opcional"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => removeGroup(group.key)}
                      title="Remover grupo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    {visibleOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhuma opção neste grupo.
                      </p>
                    )}
                    {visibleOptions.map(opt => (
                      <div key={opt.key} className="flex items-center gap-2">
                        <Input
                          placeholder="Nome da opção"
                          value={opt.nome}
                          onChange={e => updateOption(group.key, opt.key, { nome: e.target.value })}
                          className="h-9 flex-1"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground">+R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={opt.preco_adicional}
                            onChange={e =>
                              updateOption(group.key, opt.key, {
                                preco_adicional: Number(e.target.value) || 0,
                              })
                            }
                            className="h-9 w-20"
                          />
                        </div>
                        <Switch
                          checked={opt.disponivel}
                          onCheckedChange={v => updateOption(group.key, opt.key, { disponivel: v })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => removeOption(group.key, opt.key)}
                          title="Remover opção"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => addOption(group.key)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar opção
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" onClick={addGroup} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Adicionar grupo
            </Button>
          </>
        )}
      </div>

      <div className="border-t pt-4 mt-4 flex gap-2 shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving || loading}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </div>
  );
}
