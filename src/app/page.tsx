"use client";

import { useState } from "react";
import Image from "next/image";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ChatApp from "@/components/ChatApp";

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="h-14 border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-black.png" alt="MR AI" width={28} height={28} />
          <span className="font-semibold text-[15px] tracking-tight text-neutral-900">
            MR AI
          </span>
        </div>
        <div className="text-sm text-neutral-500">Professional AI Assistant</div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 mb-5">
              <Image src="/logo-black.png" alt="MR AI" width={32} height={32} />
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              {isLogin ? "Xush kelibsiz" : "Ro‘yxatdan o‘tish"}
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              {isLogin ? "Hisobingizga kiring" : "Yangi hisob yarating"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full h-11 px-3.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 text-sm focus:border-neutral-400 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Parol
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-3.5 rounded-lg border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 text-sm focus:border-neutral-400 transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Kutilmoqda..." : isLogin ? "Kirish" : "Ro‘yxatdan o‘tish"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            {isLogin ? "Hisobingiz yo‘qmi?" : "Allaqachon hisobingiz bormi?"}{" "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-neutral-900 font-medium hover:underline"
            >
              {isLogin ? "Ro‘yxatdan o‘tish" : "Kirish"}
            </button>
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-neutral-400">
        Muhammadrasul tomonidan asos solingan
      </footer>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo-black.png" alt="MR AI" width={36} height={36} className="animate-pulse" />
          <p className="text-sm text-neutral-400">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return <ChatApp />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
