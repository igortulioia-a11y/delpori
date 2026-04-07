"use client";

import { useState, useCallback } from "react";
import { Download, Loader2, Search, Check, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import type { ImportMenuItem } from "@/lib/uairango";

interface ImportMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type Step = "input" | "loading" | "preview" | "importing" | "done";

export function ImportMenuDialog({ open, onOpenChange, onImportComplete }: ImportMenuDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [token, setToken] = useState("");
  const [restaurante, setRestaurante] = useState("");
  const [items, setItems] = useState<ImportMenuItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ imported: 0, skipped: 0, errors: 0 });

  const reset = useCallback(() => {
    setStep("input");
    setToken("");
    setRestaurante("");
    setItems([]);
    setSelected(new Set());
    setExistingNames(new Set());
    setError("");
    setProgress(0);
    setImportResult({ imported: 0, skipped: 0, errors: 0 });
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open && step !== "importing") {
      reset();
    }
    onOpenChange(open);
  };

  // ─── Step 1: Buscar cardapio ──────────────────────────────────────────

  const fetchMenu = async () => {
    if (!token.trim()) return;
    setError("");
    setStep("loading");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await fetch("/api/import-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ merchantToken: token.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao buscar cardápio");
      }

      if (!data.items?.length) {
        throw new Error("Nenhum produto encontrado no cardápio");
      }

      // Buscar nomes existentes pra marcar duplicados
      const { data: existing } = await supabase
        .from("products")
        .select("nome")
        .eq("user_id", session.user.id);

      const names = new Set((existing ?? []).map((p: { nome: string }) => p.nome.toLowerCase().trim()));
      setExistingNames(names);

      setRestaurante(data.restaurante);
      setItems(data.items);
      setSelected(new Set(data.items.map((i: ImportMenuItem) => i.externalId)));
      setStep("preview");
    } catch (err: any) {
      setError(err.message);
      setStep("input");
    }
  };

  // ─── Step 3: Importar selecionados ────────────────────────────────────

  const importItems = async () => {
    const selectedItems = items.filter((i) => selected.has(i.externalId));
    if (!selectedItems.length) return;

    setStep("importing");
    setProgress(0);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Sessão expirada");
      setStep("preview");
      return;
    }

    const BATCH_SIZE = 10;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (let i = 0; i < selectedItems.length; i += BATCH_SIZE) {
      const batch = selectedItems.slice(i, i + BATCH_SIZE);

      try {
        const res = await fetch("/api/import-menu/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ items: batch, skipDuplicates }),
        });

        const data = await res.json();
        totalImported += data.imported ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalErrors += data.errors?.length ?? 0;
      } catch {
        totalErrors += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / selectedItems.length) * 100));
    }

    setImportResult({ imported: totalImported, skipped: totalSkipped, errors: totalErrors });
    setStep("done");
  };

  // ─── Helpers ──────────────────────────────────────────────────────────

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.externalId)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const isDuplicate = (nome: string) => existingNames.has(nome.toLowerCase().trim());

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Importar Cardápio do UaiRango
          </DialogTitle>
        </DialogHeader>

        {/* ─── Step: Input ─── */}
        {step === "input" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Token do estabelecimento UaiRango</Label>
              <p className="text-xs text-muted-foreground">
                No painel UaiRango, vá em <strong>Estabelecimento → Integração</strong>, ative o uso de APIs e copie o token.
              </p>
              <Input
                placeholder="Cole o token aqui..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchMenu()}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={fetchMenu} disabled={!token.trim()} className="gap-2">
                <Search className="h-4 w-4" /> Buscar Cardápio
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step: Loading ─── */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Buscando cardápio do UaiRango...</p>
          </div>
        )}

        {/* ─── Step: Preview ─── */}
        {step === "preview" && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{restaurante}</strong> · {selected.size} de {items.length} selecionados
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded"
                  />
                  Pular duplicados
                </label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selected.size === items.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[400px] border rounded-lg">
              <div className="divide-y">
                {items.map((item) => {
                  const dup = isDuplicate(item.nome);
                  return (
                    <label
                      key={item.externalId}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !selected.has(item.externalId) ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(item.externalId)}
                        onChange={() => toggleItem(item.externalId)}
                        className="rounded shrink-0"
                      />

                      {item.imagemUrl ? (
                        <img
                          src={item.imagemUrl}
                          alt={item.nome}
                          className="w-10 h-10 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.nome}</span>
                          {dup && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-300 bg-yellow-50">
                              Já existe
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{item.categoria}</span>
                      </div>

                      <span className="text-sm font-medium shrink-0">{formatPrice(item.preco)}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); setStep("input"); }}>
                Voltar
              </Button>
              <Button onClick={importItems} disabled={selected.size === 0} className="gap-2">
                <Download className="h-4 w-4" /> Importar {selected.size} {selected.size === 1 ? "item" : "itens"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ─── Step: Importing ─── */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando produtos e imagens...</p>
            <Progress value={progress} className="w-64 h-2" />
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        )}

        {/* ─── Step: Done ─── */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Importação concluída!</p>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>{importResult.imported} produto{importResult.imported !== 1 ? "s" : ""} importado{importResult.imported !== 1 ? "s" : ""}</p>
                {importResult.skipped > 0 && (
                  <p>{importResult.skipped} duplicado{importResult.skipped !== 1 ? "s" : ""} pulado{importResult.skipped !== 1 ? "s" : ""}</p>
                )}
                {importResult.errors > 0 && (
                  <p className="text-red-500">{importResult.errors} erro{importResult.errors !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                handleOpenChange(false);
                onImportComplete();
              }}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
