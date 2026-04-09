"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useState, Component, type ReactNode, type ErrorInfo } from "react";

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
                {children}
              </NotificationProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
