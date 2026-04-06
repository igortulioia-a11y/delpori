"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export type TeamRole = "owner" | "member";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  teamRole: TeamRole;
  permissoes: string[]; // abas permitidas — vazio = acesso total (owner)
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teamRole, setTeamRole] = useState<TeamRole>("owner");
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const router = useRouter();

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) setProfile(data as Profile);
  };

  const loadTeamRole = async (userId: string) => {
    // Verifica se este usuário é membro da equipe de alguém
    const { data } = await supabase
      .from("team_members")
      .select("permissoes, status, owner_id")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();

    if (data) {
      setTeamRole("member");
      setPermissoes(data.permissoes ?? []);
    } else {
      setTeamRole("owner");
      setPermissoes([]);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
        loadTeamRole(session.user.id);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(prev => {
        if (prev?.access_token === newSession?.access_token) return prev;
        return newSession;
      });
      setUser(prev => {
        const newUser = newSession?.user ?? null;
        if (prev?.id === newUser?.id) return prev;
        return newUser;
      });
      if (newSession?.user) {
        await loadProfile(newSession.user.id);
        await loadTeamRole(newSession.user.id);
      } else {
        setProfile(null);
        setTeamRole("owner");
        setPermissoes([]);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg =
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message === "Email not confirmed"
          ? "Confirme seu e-mail antes de entrar."
          : error.message;
      return { success: false, error: msg };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return { success: false, error: "Não autenticado." };
    const { error } = await supabase
      .from("profiles")
      .update({ ...data, atualizado_em: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { success: false, error: error.message };
    await loadProfile(user.id);
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, session, isAuthenticated: !!user, isLoading, teamRole, permissoes, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
