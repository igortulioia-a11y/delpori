"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Menu, UtensilsCrossed } from "lucide-react";

const routePermissaoMap: Record<string, string> = {
  "/conversas":    "conversas",
  "/pedidos":      "pedidos",
  "/produtos":     "cardapio",
  "/automacoes":   "automacoes",
  "/configuracoes":"configuracoes",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, teamRole, permissoes } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Proteção de rota para membros da equipe
  const pathname = usePathname();
  useEffect(() => {
    if (isLoading || teamRole === "owner") return;
    const requiredPermission = Object.entries(routePermissaoMap).find(([route]) =>
      pathname.startsWith(route)
    )?.[1];
    if (requiredPermission && !permissoes.includes(requiredPermission)) {
      // Redireciona para a primeira aba permitida ou dashboard
      const firstAllowed = Object.entries(routePermissaoMap).find(([, key]) => permissoes.includes(key));
      router.push(firstAllowed?.[0] ?? "/");
    }
  }, [isLoading, teamRole, permissoes, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar — só no mobile */}
        <header className="flex md:hidden items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">DeliveryHub</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
