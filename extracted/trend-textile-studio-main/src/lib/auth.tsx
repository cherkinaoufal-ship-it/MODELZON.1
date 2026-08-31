import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Profile } from "./supabase";

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Merge a partial update into the profile, locally and in Supabase. */
  updateProfile: (patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      // Profile row is created automatically by a DB trigger on signup.
      // If it's missing (e.g. trigger not installed yet), surface a clear error
      // instead of silently leaving the app in a broken half-logged-in state.
      console.error("Failed to load profile:", error.message);
      return null;
    }
    return data as Profile;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const profile = session?.user ? await loadProfile(session.user.id) : null;
      if (!mounted) return;
      setState({ user: session?.user ?? null, session, profile, loading: false, error: null });
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = session?.user ? await loadProfile(session.user.id) : null;
      setState((s) => ({ ...s, user: session?.user ?? null, session, profile, loading: false }));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return { error: error.message };
    if (data.user && !data.session) {
      return { error: "CONFIRM_EMAIL" };
    }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    setState((s) => {
      if (!s.user) return s;
      return s;
    });
    const userId = state.user?.id;
    if (!userId) return;
    const profile = await loadProfile(userId);
    setState((s) => ({ ...s, profile }));
  }, [state.user?.id, loadProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>) => {
      const userId = state.user?.id;
      if (!userId) return;
      // Optimistic local update so the UI feels instant.
      setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) console.error("Failed to save profile:", error.message);
    },
    [state.user?.id],
  );

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
