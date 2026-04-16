"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { VersionChecker } from "@/components/VersionChecker";
import { useState, Component, type ReactNode, type ErrorInfo } from "react";

// Detecta erro de carregamento de chunk JS/CSS (classico apos novo deploy na Vercel:
// cliente com JS antigo em memoria tenta baixar chunk que nao existe mais).
function isChunkLoadError(error: Error): boolean {
  if (error?.name === "ChunkLoadError") return true;
  const msg = error?.message ?? "";
  return /Loading chunk .* failed/i.test(msg) || /Loading CSS chunk/i.test(msg);
}

// Error boundary global — captura crashes do React (WebView, storage, etc)
class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GlobalErrorBoundary:", error, errorInfo);

    // Auto-recovery silencioso pra ChunkLoadError apos deploy.
    // Protecao contra loop: so recarrega se nao recarregou nos ultimos 10s.
    if (typeof window !== "undefined" && isChunkLoadError(error)) {
      try {
        const KEY = "__chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) ?? "0");
        const now = Date.now();
        if (now - last > 10_000) {
          sessionStorage.setItem(KEY, String(now));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage pode falhar em WebView restritivo — cai pro fallback UI abaixo
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: "320px" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Algo deu errado</h2>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
              Tente abrir no navegador do celular (Chrome ou Safari).
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "0.5rem 1.5rem", borderRadius: "0.5rem", background: "#ea580c", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <AuthProvider>
              <NotificationProvider>
                <Toaster />
                <VersionChecker />
                {children}
              </NotificationProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
