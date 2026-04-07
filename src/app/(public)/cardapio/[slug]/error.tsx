"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CardapioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cardapio error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <h2 className="text-lg font-semibold">Ops! Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">
          Tente abrir o link no navegador do celular (Chrome ou Safari).
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </Button>
        </div>
      </div>
    </div>
  );
}
