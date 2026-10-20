"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  Send,
  Square,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import SettingsModal from "./SettingsModal";
import type { Chat, Message, UserApiKey } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatApp() {
  const { user, signOut } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultKey, setDefaultKey] = useState<UserApiKey | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chats + default key
  useEffect(() => {
    if (!user) return;
    loadChats();
    loadDefaultKey();
  }, [user]);

  // Load messages when chat changes
  useEffect(() => {
    if (currentChatId) loadMessages(currentChatId);
    else setMessages([]);
  }, [currentChatId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadChats() {
    if (!user) return;
    const supabase = await getSupabaseBrowserClient();
    const { data } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setChats(data || []);
  }

  async function loadDefaultKey() {
    if (!user) return;
    const supabase = await getSupabaseBrowserClient();
    const { data } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    setDefaultKey(data);
  }

  async function loadMessages(chatId: string) {
    const supabase = await getSupabaseBrowserClient();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  function createNewChat() {
    if (!user) return;
    // Agar allaqachon yangi suhbatda bo'lsa yoki xabarlar bo'lmasa, ishlamasin
    if (!currentChatId || messages.length === 0) {
      setMobileSidebar(false);
      return;
    }
    setCurrentChatId(null);
    setMessages([]);
    setMobileSidebar(false);
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Suhbat o‘chirilsinmi?")) return;
    const supabase = await getSupabaseBrowserClient();
    await supabase.from("chats").delete().eq("id", id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentChatId === id) {
      setCurrentChatId(null);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming || !user) return;

    if (!defaultKey) {
      setSettingsOpen(true);
      return;
    }

    let chatId = currentChatId;

    // Create chat if needed
    if (!chatId) {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title: input.slice(0, 40) })
        .select()
        .single();
      if (!data) return;
      chatId = data.id;
      setCurrentChatId(chatId);
      setChats((prev) => [data, ...prev]);
    }

    const userMsg = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Optimistic user message
    const tempUserId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        chat_id: chatId!,
        role: "user",
        content: userMsg,
        created_at: new Date().toISOString(),
      },
    ]);

    // Save user message
    const supabase = await getSupabaseBrowserClient();
    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userMsg,
    });

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Prepare messages for API
    const history = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMsg },
    ];

    const systemPrompt = `Siz MR AI — professional AI yordamchisiz. Javoblaringiz aniq, foydali va chiroyli formatlangan bo‘lsin. Matematik formulalar uchun LaTeX ($...$) ishlating. Suhbat qaysi tilda bo‘lsa, o‘sha tilda javob bering.`;

    try {
      const baseUrl = defaultKey.base_url || getDefaultBaseUrl(defaultKey.provider);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${defaultKey.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: defaultKey.model,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
          ],
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      const tempAiId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: tempAiId,
          chat_id: chatId!,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.replace("data: ", "").trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullContent += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAiId ? { ...m, content: fullContent } : m
                )
              );
            }
          } catch {}
        }
      }

      // Save assistant message
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: fullContent,
      });

      // Update chat title if first message
      if (messages.length === 0) {
        await supabase
          .from("chats")
          .update({ title: userMsg.slice(0, 50), updated_at: new Date().toISOString() })
          .eq("id", chatId);
        loadChats();
      } else {
        await supabase
          .from("chats")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatId);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            chat_id: chatId!,
            role: "assistant",
            content: `Xatolik: ${err.message || "Noma’lum xato"}`,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "User";
  const displayUsername =
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "user";

  return (
    <div className="h-screen flex bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-[260px]" : "w-0"
        } hidden md:flex flex-col border-r border-neutral-800 bg-neutral-900 transition-all duration-200 overflow-hidden shrink-0`}
      >
        <div className="p-3">
          <button
            onClick={createNewChat}
            disabled={!currentChatId || messages.length === 0}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-200 text-sm font-medium hover:bg-neutral-800/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-950"
          >
            <Plus className="w-4 h-4" />
            Yangi suhbat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`w-full group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition cursor-pointer ${
                currentChatId === chat.id
                  ? "bg-neutral-800 text-neutral-100 font-medium"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
              <span className="truncate flex-1">{chat.title}</span>
              <span
                onClick={(e) => deleteChat(chat.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>

        {/* User section */}
        <div className="p-3 border-t border-neutral-800 space-y-1">
          <button
            onClick={() => {
              setSettingsOpen(true);
              loadDefaultKey();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 text-white flex items-center justify-center text-xs font-semibold uppercase">
              {displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-neutral-200">{displayName}</p>
              <p className="text-[11px] text-neutral-500 truncate">@{displayUsername}</p>
            </div>
            <button
              onClick={signOut}
              title="Chiqish"
              className="p-1.5 rounded-lg hover:bg-neutral-800 transition text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebar(false)} />
          <div className="relative w-[280px] bg-neutral-900 text-neutral-100 flex flex-col h-full border-r border-neutral-800">
            <div className="p-3 flex items-center justify-between border-b border-neutral-800">
              <span className="font-semibold text-sm">Suhbatlar</span>
              <button onClick={() => setMobileSidebar(false)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <button
                onClick={createNewChat}
                disabled={!currentChatId || messages.length === 0}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Yangi suhbat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setMobileSidebar(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left ${
                    currentChatId === chat.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/50"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 opacity-60" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-950">
        {/* Top bar */}
        <header className="h-14 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebar(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Image src="/logo-white.png" alt="MR AI" width={22} height={22} />
              <span className="font-semibold text-sm text-neutral-100">MR AI</span>
            </div>
          </div>

          {defaultKey ? (
            <div className="flex items-center gap-1.5 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {defaultKey.provider} · {defaultKey.model}
            </div>
          ) : (
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs text-amber-300 bg-amber-950/60 border border-amber-900/60 px-2.5 py-1 rounded-full hover:bg-amber-900/60 transition cursor-pointer"
            >
              API Key qo‘shing
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-5 shadow-inner">
                <Image src="/logo-white.png" alt="MR AI" width={32} height={32} />
              </div>
              <h2 className="text-xl font-semibold text-neutral-100 mb-1">
                MR AI bilan suhbat
              </h2>
              <p className="text-sm text-neutral-400 max-w-sm text-center">
                Savolingizni yozing. Istagan model va API key bilan ishlay olasiz.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Image src="/logo-white.png" alt="" width={18} height={18} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-neutral-800 border border-neutral-700/60 text-white"
                        : "bg-transparent text-neutral-200"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800 prose-pre:text-neutral-100">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content || "▋"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-md focus-within:border-neutral-600 transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Xabar yozing..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-4 py-3 text-[15px] text-neutral-100 placeholder:text-neutral-500 max-h-[200px] focus:outline-none"
                disabled={isStreaming}
              />
              <div className="pr-2 pb-2">
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className="w-9 h-9 rounded-xl bg-neutral-700 text-white flex items-center justify-center hover:bg-neutral-600 transition cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-xl bg-white text-neutral-950 flex items-center justify-center hover:bg-neutral-200 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-[11px] text-neutral-500 mt-2">
              MR AI · Muhammadrasul tomonidan asos solingan
            </p>
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          loadDefaultKey();
        }}
      />
    </div>
  );
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}
