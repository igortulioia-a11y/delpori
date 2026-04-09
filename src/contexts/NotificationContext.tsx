"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  playNewOrderSound,
  playHumanNeededSound,
} from "@/lib/notification-sound";

const STORAGE_KEY = "delpori-notification-sound";

interface NotificationContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Preferencia persistida em localStorage (SSR-safe)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEY) !== "disabled";
    } catch {
      return true;
    }
  });

  // Ref espelho pra evitar closure stale dentro dos callbacks do realtime
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, soundEnabled ? "enabled" : "disabled");
    } catch {
      // Ignora falhas de localStorage (WebView, modo privado, etc.)
    }
  }, [soundEnabled]);

  const toggleSound = () => setSoundEnabled((v) => !v);

  // Subscription global: novos pedidos
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const order = payload.new as { numero?: number; id?: string };
          if (soundEnabledRef.current) playNewOrderSound();
          toast({
            title: "Novo pedido!",
            description: `Pedido #${order.numero ?? "?"} acabou de chegar`,
            duration: 10000,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Subscription global: conversa marcada como "precisa humano" (ai_paused false -> true)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-conversations-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { ai_paused?: boolean } | null;
          const newRow = payload.new as {
            ai_paused?: boolean;
            cliente_nome?: string | null;
          } | null;
          const wasAiPaused = oldRow?.ai_paused === true;
          const isAiPaused = newRow?.ai_paused === true;
          // So dispara na transicao false -> true
          if (!wasAiPaused && isAiPaused) {
            const nome = newRow?.cliente_nome || "Cliente";
            if (soundEnabledRef.current) playHumanNeededSound();
            toast({
              title: "Precisa de atendimento",
              description: `${nome} foi passado pra atendimento humano`,
              duration: 10000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </NotificationContext.Provider>
  );
}
