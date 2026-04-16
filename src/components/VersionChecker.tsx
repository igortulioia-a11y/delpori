"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Poll interval: 5 min (suficiente pra pegar deploys sem sobrecarregar servidor).
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Se o fetch falhar, silenciar (degrada pro comportamento atual sem banner).
async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function VersionChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialVersion: string | null = null;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      const current = await fetchVersion();
      if (cancelled || !current) return;

      if (initialVersion === null) {
        initialVersion = current;
        return;
      }

      if (current !== initialVersion) {
        setUpdateAvailable(true);
      }
    };

    // Primeira carga: pega initialVersion
    check();

    // Poll periodico
    intervalId = setInterval(check, POLL_INTERVAL_MS);

    // Quando usuario volta pra aba, checa imediatamente
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-primary px-4 py-2 text-primary-foreground shadow-md"
    >
      <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">Nova versão disponível</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30 transition-colors"
      >
        Atualizar
      </button>
    </div>
  );
}
