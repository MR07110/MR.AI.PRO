"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function formatUsernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  const clean = trimmed.replace(/[^a-z0-9_.-]/g, "");
  return `${clean}@mrai.local`;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ data?: any; error: string | null }>;
  signUp: (name: string, username: string, password: string) => Promise<{ data?: any; error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const supabase = await getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Auth init error:", err);
        if (mounted) setLoading(false);
      }
    }

    const cleanup = init();
    return () => {
      mounted = false;
      cleanup.then((fn) => fn && fn());
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    const supabase = await getSupabaseBrowserClient();
    const email = formatUsernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error: error?.message ?? null };
  };

  const signUp = async (name: string, username: string, password: string) => {
    const supabase = await getSupabaseBrowserClient();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const email = formatUsernameToEmail(cleanUsername);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          username: cleanUsername,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.session) {
      setSession(data.session);
      setUser(data.user);
      return { data, error: null };
    }

    // Attempt automatic login immediately if session wasn't returned
    const signInRes = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInRes.data?.session) {
      setSession(signInRes.data.session);
      setUser(signInRes.data.user);
      return { data: signInRes.data, error: null };
    }

    return { data, error: null };
  };

  const signOut = async () => {
    const supabase = await getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
