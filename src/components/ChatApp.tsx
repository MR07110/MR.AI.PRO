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
  ShieldAlert,
  Key,
  Copy,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  ArrowDown,
  Brain,
  ChevronDown,
  ChevronUp,
  Code2,
  Sparkles,
  PenTool,
  Compass,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import SettingsModal from "./SettingsModal";
import type { Chat, Message, UserApiKey } from "@/types";
import { loadSettings, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// CodeBlock with Language Header & Copy Button
function CodeBlock({ language, value }: { language?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3.5 rounded-xl border border-neutral-800 bg-neutral-900/95 overflow-hidden text-xs shadow-md">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800 bg-neutral-950/80 text-neutral-400 font-mono">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
          {language || "kod"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Nusxalandi</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Nusxalash</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-neutral-100">
        <pre>{value}</pre>
      </div>
    </div>
  );
}

// Collapsible Thinking / Reasoning Block (Claude / DeepSeek style)
function ThinkingBlock({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-neutral-400 hover:text-neutral-200 bg-neutral-900/70 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-medium text-neutral-300">Fikrlash jarayoni (Reasoning)</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
      </button>
      {open && (
        <div className="p-3.5 border-t border-neutral-800/80 text-neutral-400 leading-relaxed font-mono whitespace-pre-wrap text-[12px] bg-neutral-950/40">
          {thinking}
        </div>
      )}
    </div>
  );
}

// Split thinking tags from assistant output
function parseThinkingAndContent(raw: string) {
  const thinkMatch = raw.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    const content = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();
    return { thinking, content };
  }
  return { thinking: null, content: raw };
}

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
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Chat renaming state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chats + default key + settings
  useEffect(() => {
    if (!user) return;
    loadChats();
    loadDefaultKey();
    setAppSettings(loadSettings());

    function onSettingsUpdate() {
      setAppSettings(loadSettings());
    }
    window.addEventListener("mr_ai_settings_updated", onSettingsUpdate);
    return () => window.removeEventListener("mr_ai_settings_updated", onSettingsUpdate);
  }, [user]);

  // Load messages when chat changes
  useEffect(() => {
    if (currentChatId) loadMessages(currentChatId);
    else setMessages([]);
  }, [currentChatId]);

  // Handle scroll events to detect if user scrolled up
  const handleScroll = () => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setIsScrolledUp(!isNearBottom);
  };

  // Auto scroll only when near bottom
  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isScrolledUp]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsScrolledUp(false);
  };

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

  async function saveChatTitle(id: string) {
    if (!editingTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    const cleanTitle = editingTitle.trim();
    const supabase = await getSupabaseBrowserClient();
    await supabase.from("chats").update({ title: cleanTitle }).eq("id", id);
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: cleanTitle } : c))
    );
    setEditingChatId(null);
  }

  // Copy assistant response
  const copyResponse = async (id: string, content: string) => {
    try {
      const { content: cleanText } = parseThinkingAndContent(content);
      await navigator.clipboard.writeText(cleanText || content);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {}
  };

  // Edit user message (load into prompt)
  const editUserMessage = (text: string) => {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(autoResize, 50);
    }
  };

  // Core Send Logic via Server API (/api/chat)
  async function executeChatStream(
    chatId: string,
    history: Array<{ role: "user" | "assistant"; content: string }>
  ) {
    if (!defaultKey) {
      setSettingsOpen(true);
      return;
    }

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const tempAiId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: tempAiId,
        chat_id: chatId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    const isStream = appSettings.stream !== false;
    let fullContent = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          apiKey: defaultKey.api_key,
          provider: defaultKey.provider,
          model: defaultKey.model,
          baseUrl: defaultKey.base_url || undefined,
          systemPrompt: appSettings.systemPrompt || undefined,
          temperature: appSettings.temperature ?? 0.7,
          maxTokens: appSettings.maxTokens ?? 4096,
          stream: isStream,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMessage = errJson.error || errMessage;
        } catch {
          const txt = await res.text();
          if (txt) errMessage = txt;
        }
        throw new Error(errMessage);
      }

      if (isStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempAiId ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {}
          }
        }
      } else {
        const data = await res.json();
        fullContent = data.content || "";
        setMessages((prev) =>
          prev.map((m) => (m.id === tempAiId ? { ...m, content: fullContent } : m))
        );
      }

      // Save assistant message to Supabase
      const supabase = await getSupabaseBrowserClient();
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: fullContent,
      });

      // Update chat timestamp
      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errorContent = `Xatolik: ${err.message || "Noma’lum xato"}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiId ? { ...m, content: errorContent } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  // Send new user prompt
  async function sendMessage(promptOverride?: string) {
    const textToSend = (promptOverride || input).trim();
    if (!textToSend || isStreaming || !user) return;

    if (!defaultKey) {
      setSettingsOpen(true);
      return;
    }

    let chatId = currentChatId;
    const supabase = await getSupabaseBrowserClient();

    // Create chat if not exists
    if (!chatId) {
      const { data } = await supabase
        .from("chats")
        .insert({ user_id: user.id, title: textToSend.slice(0, 45) })
        .select()
        .single();
      if (!data) return;
      chatId = data.id;
      setCurrentChatId(chatId);
      setChats((prev) => [data, ...prev]);
    }

    if (!chatId) return;
    const activeChatId: string = chatId;

    if (!promptOverride) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }

    // Append user message
    const tempUserId = crypto.randomUUID();
    const nextUserMsg: Message = {
      id: tempUserId,
      chat_id: activeChatId,
      role: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, nextUserMsg]);

    // Save to Supabase
    await supabase.from("messages").insert({
      chat_id: activeChatId,
      role: "user",
      content: textToSend,
    });

    // Prepare history
    const history = [
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: textToSend },
    ];

    await executeChatStream(activeChatId, history);
  }

  // Regenerate last assistant response (Claude style)
  async function regenerateResponse() {
    if (isStreaming || !currentChatId || messages.length === 0) return;

    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;

    const trimmedMessages = messages.slice(0, lastUserIdx + 1);
    setMessages(trimmedMessages);

    const supabase = await getSupabaseBrowserClient();
    const cutTime = trimmedMessages[lastUserIdx].created_at;
    await supabase
      .from("messages")
      .delete()
      .eq("chat_id", currentChatId)
      .eq("role", "assistant")
      .gt("created_at", cutTime);

    const history = trimmedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    await executeChatStream(currentChatId, history);
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (appSettings.sendOnEnter !== false) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    } else {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
      }
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "Foydalanuvchi";
  const displayUsername =
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "user";

  const themeBg =
    appSettings.themeStyle === "midnight"
      ? "bg-[#0b1329]"
      : appSettings.themeStyle === "carbon"
      ? "bg-[#141416]"
      : "bg-neutral-950";

  const fontSizeClass =
    appSettings.fontSize === "sm"
      ? "text-[14px]"
      : appSettings.fontSize === "lg"
      ? "text-[16px]"
      : "text-[15px]";

  const suggestions = [
    {
      title: "Dasturlash va kod",
      desc: "Toza, xavfsiz va optimallashgan kod yozish",
      icon: Code2,
      prompt: "React va TypeScript da toza arxitekturali zamonaviy komponent yozib ber.",
    },
    {
      title: "Tahlil va tushuntirish",
      desc: "Murakkab mavzuni sodda qilib tushuntirish",
      icon: Sparkles,
      prompt: "Kvant kompyuterlari qanday ishlashini oddiy va tushunarli tilda tushuntirib ber.",
    },
    {
      title: "Yozish va tahrirlash",
      desc: "Professional maqola yoki hujjat matni",
      icon: PenTool,
      prompt: "IT kompaniyaga ishga kirish uchun ta’sirchan va professional cover letter yozib ber.",
    },
    {
      title: "G‘oya va reja tuzish",
      desc: "Loyihani bosqichma-bosqich rejalashtirish",
      icon: Compass,
      prompt: "Yangi AI startapni ishga tushirish uchun 30 kunlik amaliy reja tuzib ber.",
    },
  ];

  // Markdown custom renderers
  const markdownComponents = {
    table({ children }: any) {
      return (
        <div className="my-3.5 w-full overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/40">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">{children}</table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead className="bg-neutral-900/90 border-b border-neutral-800 text-neutral-200">{children}</thead>;
    },
    tbody({ children }: any) {
      return <tbody className="divide-y divide-neutral-800/80">{children}</tbody>;
    },
    tr({ children }: any) {
      return <tr className="hover:bg-neutral-900/40 transition">{children}</tr>;
    },
    th({ children }: any) {
      return (
        <th className="px-3.5 py-2.5 font-semibold text-xs tracking-wider uppercase text-neutral-300 border-r border-neutral-800/60 last:border-r-0 whitespace-nowrap">
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td className="px-3.5 py-2.5 text-xs sm:text-sm text-neutral-300 border-r border-neutral-800/60 last:border-r-0">
          {children}
        </td>
      );
    },
    ul({ children }: any) {
      return <ul className="my-2 pl-5 list-disc space-y-1 text-neutral-300">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="my-2 pl-5 list-decimal space-y-1 text-neutral-300">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="leading-relaxed">{children}</li>;
    },
    blockquote({ children }: any) {
      return (
        <blockquote className="my-2.5 pl-3.5 border-l-2 border-neutral-600 italic text-neutral-400 bg-neutral-900/30 py-1 rounded-r-lg">
          {children}
        </blockquote>
      );
    },
    h1({ children }: any) {
      return <h1 className="text-lg sm:text-xl font-bold text-neutral-100 mt-4 mb-2 pb-1 border-b border-neutral-800">{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="text-base sm:text-lg font-bold text-neutral-100 mt-3.5 mb-1.5">{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 className="text-sm sm:text-base font-semibold text-neutral-200 mt-3 mb-1">{children}</h3>;
    },
    p({ children }: any) {
      return <p className="my-1.5 leading-relaxed text-neutral-300">{children}</p>;
    },
    a({ href, children }: any) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          {children}
        </a>
      );
    },
    hr() {
      return <hr className="my-3.5 border-neutral-800" />;
    },
    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const codeValue = String(children).replace(/\n$/, "");
      if (match || codeValue.includes("\n")) {
        return <CodeBlock language={match ? match[1] : undefined} value={codeValue} />;
      }
      return (
        <code className="bg-neutral-800/80 text-neutral-200 px-1.5 py-0.5 rounded text-[12px] font-mono border border-neutral-700/50" {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`h-screen flex ${themeBg} text-neutral-100 overflow-hidden`}>
      {/* Desktop & Tablet Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-[270px]" : "w-0"
        } hidden md:flex flex-col border-r border-neutral-800/80 bg-neutral-900/95 transition-all duration-200 overflow-hidden shrink-0 shadow-sm`}
      >
        <div className="p-3">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-100 text-xs font-semibold hover:bg-neutral-800/90 transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Yangi suhbat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`w-full group flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition cursor-pointer ${
                currentChatId === chat.id
                  ? "bg-neutral-800/90 text-white font-medium border border-neutral-700/60"
                  : "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />

              {editingChatId === chat.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveChatTitle(chat.id);
                  }}
                  className="flex-1 min-w-0"
                >
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => saveChatTitle(chat.id)}
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  />
                </form>
              ) : (
                <span className="truncate flex-1">{chat.title}</span>
              )}

              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingChatId(chat.id);
                    setEditingTitle(chat.title);
                  }}
                  title="Nomini o‘zgartirish"
                  className="p-1 hover:text-white transition cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteChat(chat.id, e)}
                  title="O‘chirish"
                  className="p-1 hover:text-red-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* User profile & settings footer */}
        <div className="p-3 border-t border-neutral-800/80 space-y-1.5 bg-neutral-950/40">
          <button
            onClick={() => {
              setSettingsOpen(true);
              loadDefaultKey();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-800/80 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Sozlamalar (Settings)
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-neutral-200">{displayName}</p>
              <p className="text-[10px] text-neutral-500 truncate">@{displayUsername}</p>
            </div>
            <button
              onClick={signOut}
              title="Chiqish"
              className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebar(false)} />
          <div className="relative w-[280px] max-w-[85vw] bg-neutral-900 text-neutral-100 flex flex-col h-full border-r border-neutral-800 z-10 shadow-2xl">
            <div className="p-3.5 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Image src="/logo-white.png" alt="MR AI" width={20} height={20} />
                <span className="font-bold text-sm">MR AI Suhbatlar</span>
              </div>
              <button
                onClick={() => setMobileSidebar(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={createNewChat}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs font-semibold text-neutral-100 hover:bg-neutral-800 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Yangi suhbat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setMobileSidebar(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-left transition cursor-pointer ${
                    currentChatId === chat.id
                      ? "bg-neutral-800 text-white font-medium border border-neutral-700"
                      : "text-neutral-400 hover:bg-neutral-800/50"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate flex-1">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(chat.id, e)}
                    title="O‘chirish"
                    className="p-1 text-neutral-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-neutral-800 space-y-1 bg-neutral-950/60">
              <button
                onClick={() => {
                  setMobileSidebar(false);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                Sozlamalar (Settings)
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                  {displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-neutral-200">{displayName}</p>
                  <p className="text-[10px] text-neutral-500 truncate">@{displayUsername}</p>
                </div>
                <button
                  onClick={signOut}
                  title="Chiqish"
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${themeBg}`}>
        {/* Top Header Navigation */}
        <header className="h-14 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileSidebar(true)}
              className="md:hidden p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition"
              title="Menyu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition cursor-pointer"
              title={sidebarOpen ? "Yon panelni yopish" : "Yon panelni ochish"}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Image src="/logo-white.png" alt="MR AI" width={22} height={22} className="shrink-0" />
              <span className="font-bold text-sm text-neutral-100 tracking-tight">MR AI</span>
            </div>
          </div>

          {/* Center / Right controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick New Chat Button (available on all devices) */}
            <button
              onClick={createNewChat}
              title="Yangi suhbat"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white transition text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yangi</span>
            </button>

            {/* Active Model Pill */}
            {defaultKey ? (
              <button
                onClick={() => setSettingsOpen(true)}
                title="Modelni almashtirish uchun bosing"
                className="flex items-center gap-1.5 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-full hover:border-neutral-700 transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-medium capitalize text-[11px] sm:text-xs">{defaultKey.provider}</span>
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-400 truncate max-w-[90px] sm:max-w-[140px] text-[11px] sm:text-xs">
                  {defaultKey.model}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-xs text-amber-300 bg-amber-950/60 border border-amber-900/60 px-2.5 py-1.5 rounded-full hover:bg-amber-900/60 transition cursor-pointer flex items-center gap-1.5"
              >
                <Key className="w-3 h-3" />
                <span className="text-[11px] sm:text-xs">API Key</span>
              </button>
            )}

            {/* Settings Gear */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Sozlamalar"
              className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Messages Scroll Area */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 max-w-2xl mx-auto py-12">
              <div className="w-13 h-13 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 shadow-sm">
                <Image src="/logo-white.png" alt="MR AI" width={30} height={30} />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-100 mb-1.5 text-center">
                Qanday yordam bera olaman?
              </h2>
              <p className="text-xs text-neutral-400 text-center max-w-md mb-8 leading-relaxed">
                Istalgan model (Claude, GPT-4o, DeepSeek R1, Groq) orqali professional va xavfsiz suhbatlashing.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {suggestions.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(s.prompt)}
                      className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 text-left transition group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-neutral-400 group-hover:text-white transition" />
                        <span className="text-xs font-semibold text-neutral-200">
                          {s.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        {s.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3.5 sm:px-6 py-6 space-y-6">
              {messages.map((msg, index) => {
                const isAssistant = msg.role === "assistant";
                const isLastAssistant =
                  isAssistant && index === messages.length - 1;
                const { thinking, content } = isAssistant
                  ? parseThinkingAndContent(msg.content)
                  : { thinking: null, content: msg.content };

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 group ${!isAssistant ? "justify-end" : ""}`}
                  >
                    {isAssistant && (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <Image src="/logo-white.png" alt="" width={16} height={16} />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] sm:max-w-[82%] rounded-2xl ${
                        !isAssistant
                          ? `bg-neutral-800/90 border border-neutral-700/60 text-white px-4 py-2.5 ${fontSizeClass}`
                          : "bg-transparent text-neutral-200 min-w-0"
                      }`}
                    >
                      {isAssistant ? (
                        msg.content.startsWith("Xatolik:") ||
                        msg.content.includes("API kalit xatosi") ? (
                          <div className="p-4 rounded-xl border border-red-900/60 bg-red-950/40 text-red-300 text-sm space-y-3">
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span className="leading-relaxed font-medium text-xs sm:text-sm">
                                {msg.content.replace(/^Xatolik:\s*/, "")}
                              </span>
                            </div>
                            <button
                              onClick={() => setSettingsOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-white text-xs font-semibold transition cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                              Sozlamalar (API Keyni almashtirish)
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {thinking && <ThinkingBlock thinking={thinking} />}

                            <div className="markdown-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {content || (isStreaming && isLastAssistant ? "..." : "")}
                              </ReactMarkdown>
                            </div>

                            {/* Message Actions Bar (Claude Style) */}
                            {content && !isStreaming && (
                              <div className="flex items-center gap-1 pt-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => copyResponse(msg.id, msg.content)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer flex items-center gap-1 text-[11px]"
                                  title="Javobni nusxalash"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-400 font-medium">Nusxalandi</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Nusxalash</span>
                                    </>
                                  )}
                                </button>

                                {isLastAssistant && (
                                  <button
                                    type="button"
                                    onClick={regenerateResponse}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer flex items-center gap-1 text-[11px]"
                                    title="Qayta urinish (Regenerate)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Qayta urinish</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="space-y-1">
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <div className="flex justify-end pt-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => editUserMessage(msg.content)}
                              className="p-1 rounded text-neutral-400 hover:text-white transition cursor-pointer"
                              title="Tahrirlash va qayta yuborish"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Floating Scroll to Bottom Button */}
          {isScrolledUp && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-24 right-4 sm:right-8 z-30 p-2.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white shadow-xl transition cursor-pointer flex items-center justify-center"
              title="Pastga tushish"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-neutral-800/80 bg-neutral-950 px-3 sm:px-4 py-2.5 sm:py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-lg focus-within:border-neutral-600 focus-within:ring-1 focus-within:ring-neutral-600 transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Xabar yozing (Shift+Enter yangi qator)..."
                rows={1}
                className={`flex-1 resize-none bg-transparent px-3.5 sm:px-4 py-3 ${fontSizeClass} text-neutral-100 placeholder:text-neutral-500 max-h-[220px] focus:outline-none`}
                disabled={isStreaming}
              />
              <div className="pr-2 pb-2">
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    title="To‘xtatish"
                    className="w-9 h-9 rounded-xl bg-neutral-700 text-white flex items-center justify-center hover:bg-neutral-600 transition cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    title="Yuborish"
                    className="w-9 h-9 rounded-xl bg-white text-neutral-950 flex items-center justify-center hover:bg-neutral-200 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-[10px] sm:text-[11px] text-neutral-500 mt-2 font-mono">
              MR AI Pro · Algoritmik Intellektual Platforma
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
