"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserMetadata {
  full_name: string;
  username: string;
}

export interface User {
  id: string;
  email: string;
  user_metadata: UserMetadata;
}

export interface Session {
  user: User;
  access_token: string;
}

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

const STORAGE_KEY_USER = "mrai_auth_user";
const STORAGE_KEY_PASS = "mrai_auth_password";

const DEFAULT_USER: User = {
  id: "mrqosimov2011",
  email: "mrqosimov2011@mrai.local",
  user_metadata: {
    full_name: "Mr Qosimov",
    username: "mrqosimov2011",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const parsed: User = JSON.parse(saved);
        setUser(parsed);
        setSession({ user: parsed, access_token: "mrai-token" });
      } else {
        // By default, since this is a private personal server, auto-activate default user
        setUser(DEFAULT_USER);
        setSession({ user: DEFAULT_USER, access_token: "mrai-token" });
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(DEFAULT_USER));
      }
    } catch {
      setUser(DEFAULT_USER);
      setSession({ user: DEFAULT_USER, access_token: "mrai-token" });
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const savedPass = localStorage.getItem(STORAGE_KEY_PASS);

    if (savedPass && savedPass !== password) {
      return { error: "Parol noto‘g‘ri kiritildi" };
    }

    const authUser: User = {
      id: cleanUsername || "mrqosimov2011",
      email: formatUsernameToEmail(cleanUsername || "mrqosimov2011"),
      user_metadata: {
        full_name: cleanUsername === "mrqosimov2011" ? "Mr Qosimov" : cleanUsername,
        username: cleanUsername,
      },
    };

    setUser(authUser);
    setSession({ user: authUser, access_token: "mrai-token" });
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
    if (password) {
      localStorage.setItem(STORAGE_KEY_PASS, password);
    }

    return { data: { user: authUser }, error: null };
  };

  const signUp = async (name: string, username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const authUser: User = {
      id: cleanUsername,
      email: formatUsernameToEmail(cleanUsername),
      user_metadata: {
        full_name: name.trim(),
        username: cleanUsername,
      },
    };

    setUser(authUser);
    setSession({ user: authUser, access_token: "mrai-token" });
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
    if (password) {
      localStorage.setItem(STORAGE_KEY_PASS, password);
    }

    return { data: { user: authUser }, error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
