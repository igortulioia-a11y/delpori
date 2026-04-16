"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, ClipboardList, Package,
  Zap, Settings, LogOut, Sun, Moon, Bell, BellOff,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

const allNavItems = [
  { title: "Dashboard",     url: "/",              icon: LayoutDashboard, key: "dashboard" },
  { title: "Conversas",     url: "/conversas",     icon: MessageSquare,   key: "conversas" },
  { title: "Pedidos",       url: "/pedidos",        icon: ClipboardList,   key: "pedidos" },
  { title: "Cardápio",      url: "/produtos",       icon: Package,         key: "cardapio" },
  { title: "Automações",    url: "/automacoes",     icon: Zap,             key: "automacoes" },
  { title: "Configurações", url: "/configuracoes",  icon: Settings,        key: "configuracoes" },
];

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, profile, logout, teamRole, permissoes } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundEnabled, toggleSound } = useNotifications();

  // Owner vê tudo; member vê só as abas permitidas
  const navItems = teamRole === "owner"
    ? allNavItems
    : allNavItems.filter(item => permissoes.includes(item.key));

  const displayName = profile?.nome ?? user?.email?.split("@")[0] ?? "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  const sidebarContent = (
    <aside className="flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border shrink-0">
        <img src="/logo-icon.png" alt="Delpori" className="h-9 w-9" />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">Delpori</span>
          <span className="text-xs text-sidebar-foreground">Gestão de Delivery</span>
        </div>
        {/* Toggle de som de notificacao */}
        <button
          onClick={toggleSound}
          className="text-sidebar-foreground hover:text-white transition-colors shrink-0"
          title={soundEnabled ? "Desativar sons" : "Ativar sons"}
          aria-label={soundEnabled ? "Desativar sons de notificação" : "Ativar sons de notificação"}
        >
          {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </button>
        {/* Dark mode toggle no header */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-sidebar-foreground hover:text-white transition-colors shrink-0"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
          return (
            <Link
              key={item.title}
              href={item.url}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white font-medium border-l-2 border-l-[hsl(var(--sidebar-primary))]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 shrink-0">
        <div className="flex items-center gap-3">
          {profile?.logo_url ? (
            <img src={profile.logo_url} alt={displayName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </div>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-white truncate">{displayName}</span>
            <span className="text-xs text-sidebar-foreground truncate">{user?.email ?? ""}</span>
          </div>
          <button
            onClick={logout}
            className="text-sidebar-foreground hover:text-destructive transition-colors shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: sidebar fixa na tela */}
      <div className="hidden md:flex sticky top-0 h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: drawer com overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
