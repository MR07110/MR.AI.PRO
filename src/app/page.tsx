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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (isLogin) {
      const result = await signIn(email, password);
      if (result.error) {
        if (result.error.toLowerCase().includes("invalid login credentials")) {
          setError("Email yoki parol noto‘g‘ri. Agar ro‘yxatdan o‘tmagan bo‘lsangiz, 'Ro‘yxatdan o‘tish' tugmasini bosing.");
        } else {
          setError(result.error);
        }
      }
    } else {
      const result = await signUp(email, password);
      if (result.error) {
        if (result.error.includes("security purposes")) {
          setError("Xavfsizlik yuzasidan cheklov: Qayta urinish uchun biroz kuting. Agar hisob yaratib bo‘lgan bo‘lsangiz, 'Kirish' bo‘limidan kiring.");
        } else {
          setError(result.error);
        }
      } else {
        if (!result.data?.session) {
          setSuccess("Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi! Emailingizga tasdiqlash havolasi yuborildi (pochtangizni tekshiring). Tasdiqlagach 'Kirish' orqali kiring.");
          setIsLogin(true);
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-white.png" alt="MR AI" width={28} height={28} />
          <span className="font-semibold text-[15px] tracking-tight text-neutral-100">
            MR AI
          </span>
        </div>
        <div className="text-sm text-neutral-400">Professional AI Assistant</div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 mb-5 shadow-inner">
              <Image src="/logo-white.png" alt="MR AI" width={32} height={32} />
            </div>
            <h1 className="text-2xl font-semibold text-neutral-100 tracking-tight">
              {isLogin ? "Xush kelibsiz" : "Ro‘yxatdan o‘tish"}
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              {isLogin ? "Hisobingizga kiring" : "Yangi hisob yarating"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Parol
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none transition"
              />
            </div>

            {success && (
              <p className="text-sm text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-3.5 py-2.5 rounded-lg">
                {success}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-lg bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-200 transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Kutilmoqda..." : isLogin ? "Kirish" : "Ro‘yxatdan o‘tish"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-400">
            {isLogin ? "Hisobingiz yo‘qmi?" : "Allaqachon hisobingiz bormi?"}{" "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setSuccess("");
              }}
              className="text-white font-medium hover:underline cursor-pointer"
            >
              {isLogin ? "Ro‘yxatdan o‘tish" : "Kirish"}
            </button>
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-neutral-500">
        Muhammadrasul tomonidan asos solingan
      </footer>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo-white.png" alt="MR AI" width={36} height={36} className="animate-pulse" />
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
