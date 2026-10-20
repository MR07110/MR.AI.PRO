"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Check, X, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserApiKey, Provider } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export interface ProviderOption {
  value: Provider;
  label: string;
  placeholder: string;
  defaultModel: string;
  defaultBaseUrl: string;
  models: { id: string; name: string }[];
}

export const PROVIDERS: ProviderOption[] = [
  {
    value: "groq",
    label: "Groq (Ultra tez, bepul limitlar)",
    placeholder: "gsk_...",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Tavsiya etiladi)" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Juda tez)" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B (Mantiqiy fikrlash)" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (32k kontekst)" },
      { id: "gemma2-9b-it", name: "Google Gemma 2 9B" },
    ],
  },
  {
    value: "deepseek",
    label: "DeepSeek (R1 & V3)",
    placeholder: "sk-...",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek-V3 (Umumiy universal)" },
      { id: "deepseek-reasoner", name: "DeepSeek-R1 (Fikrlash / Reasoning)" },
    ],
  },
  {
    value: "openai",
    label: "OpenAI (ChatGPT)",
    placeholder: "sk-proj-...",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", name: "GPT-4o (Eng aqlli va ko‘p qirrali)" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Tez va tejamkor)" },
      { id: "o3-mini", name: "o3-mini (Reasoning / Dasturlash)" },
      { id: "o1", name: "o1 (Chuqur fikrlovchi model)" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
  },
  {
    value: "gemini",
    label: "Google Gemini (Google AI Studio)",
    placeholder: "AIzaSy...",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Yangi avlod, tez)" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (2M ulkan kontekst)" },
    ],
  },
  {
    value: "openrouter",
    label: "OpenRouter (Barcha modellar)",
    placeholder: "sk-or-v1-...",
    defaultModel: "anthropic/claude-3.5-sonnet",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
      { id: "openai/gpt-4o", name: "OpenAI GPT-4o" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
    ],
  },
  {
    value: "xai",
    label: "xAI (Grok)",
    placeholder: "xai-...",
    defaultModel: "grok-2-latest",
    defaultBaseUrl: "https://api.x.ai/v1",
    models: [
      { id: "grok-2-latest", name: "Grok 2" },
      { id: "grok-2-vision-latest", name: "Grok 2 Vision" },
      { id: "grok-beta", name: "Grok Beta" },
    ],
  },
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-api03-...",
    defaultModel: "claude-3-5-sonnet-20241022",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
  },
  {
    value: "mistral",
    label: "Mistral AI",
    placeholder: "mistral_api_key...",
    defaultModel: "mistral-large-latest",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "codestral-latest", name: "Codestral (Dasturchilar uchun)" },
      { id: "open-mistral-nemo", name: "Mistral Nemo" },
    ],
  },
  {
    value: "together",
    label: "Together AI",
    placeholder: "together_api_key...",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    defaultBaseUrl: "https://api.together.xyz/v1",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo" },
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
      { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B Turbo" },
    ],
  },
  {
    value: "perplexity",
    label: "Perplexity AI (Web qidiruv)",
    placeholder: "pplx-...",
    defaultModel: "sonar-pro",
    defaultBaseUrl: "https://api.perplexity.ai",
    models: [
      { id: "sonar-pro", name: "Sonar Pro (Qidiruvli chuqur javob)" },
      { id: "sonar", name: "Sonar (Tezkor qidiruv)" },
      { id: "sonar-reasoning", name: "Sonar Reasoning" },
    ],
  },
  {
    value: "custom",
    label: "Custom / Boshqa (OpenAI-mos)",
    placeholder: "sk-...",
    defaultModel: "",
    defaultBaseUrl: "",
    models: [],
  },
];

export default function SettingsModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [provider, setProvider] = useState<Provider>("groq");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const currentProvider = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];

  useEffect(() => {
    if (open && user) {
      loadKeys();
    }
  }, [open, user]);

  async function loadKeys() {
    setLoading(true);
    const supabase = await getSupabaseBrowserClient();
    const { data } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    setKeys(data || []);
    setLoading(false);
  }

  function onProviderChange(p: Provider) {
    setProvider(p);
    setError("");
    const found = PROVIDERS.find((x) => x.value === p);
    if (found) {
      setIsCustomModel(found.models.length === 0);
      setCustomModelName("");
      setModel(found.defaultModel);
      setBaseUrl(found.defaultBaseUrl);
    }
  }

  async function handleSave() {
    setError("");
    const trimmedKey = apiKey.trim();
    const finalModel = isCustomModel ? customModelName.trim() : model.trim();

    if (!trimmedKey) {
      setError("Iltimos, API kalitni kiriting");
      return;
    }
    if (!finalModel) {
      setError("Iltimos, modelni tanlang yoki nomini kiriting");
      return;
    }

    setSaving(true);
    setStatusMessage("API kalit tekshirilmoqda...");

    // 1. API kalitni server orqali haqiqiyligini tekshirish
    try {
      const validateRes = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: trimmedKey,
          model: finalModel,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });

      const validateData = await validateRes.json();

      if (!validateData.valid) {
        // Kalit xato bo'lsa, SAQLANMAYDI!
        setError(validateData.error || "API kalit yaroqsiz! Saqlanmadi.");
        setSaving(false);
        setStatusMessage("");
        return;
      }
    } catch (err: any) {
      setError("Tekshirishda xatolik yuz berdi: " + err.message);
      setSaving(false);
      setStatusMessage("");
      return;
    }

    // 2. Kalit to‘g‘ri bo‘lsa, Supabase'ga saqlash
    setStatusMessage("Kalit to‘g‘ri! Saqlanmoqda...");
    const supabase = await getSupabaseBrowserClient();

    const shouldBeDefault = isDefault || keys.length === 0;

    if (shouldBeDefault) {
      await supabase
        .from("user_api_keys")
        .update({ is_default: false })
        .eq("user_id", user?.id);
    }

    const { error: insertError } = await supabase.from("user_api_keys").insert({
      user_id: user?.id,
      provider,
      name: name.trim() || `${currentProvider.label.split(" ")[0]} (${finalModel})`,
      api_key: trimmedKey,
      model: finalModel,
      base_url: baseUrl.trim() || null,
      is_default: shouldBeDefault,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      setStatusMessage("");
      return;
    }

    // Reset form
    setName("");
    setApiKey("");
    setIsDefault(false);
    setShowForm(false);
    setSaving(false);
    setStatusMessage("");
    loadKeys();
  }

  async function setAsDefault(id: string) {
    const supabase = await getSupabaseBrowserClient();
    await supabase
      .from("user_api_keys")
      .update({ is_default: false })
      .eq("user_id", user?.id);

    await supabase
      .from("user_api_keys")
      .update({ is_default: true })
      .eq("id", id);

    loadKeys();
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu API keyni o‘chirmoqchimisiz?")) return;
    const supabase = await getSupabaseBrowserClient();
    await supabase.from("user_api_keys").delete().eq("id", id);
    loadKeys();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-neutral-900 text-neutral-100 rounded-2xl shadow-2xl border border-neutral-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-neutral-300" />
            <h2 className="text-lg font-semibold text-neutral-100">My API Keys</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!showForm ? (
            <>
              <p className="text-sm text-neutral-400 mb-4">
                Istagan AI provayderi uchun o‘z API kalitlaringizni qo‘shing. Kalitlar xavfsiz holda faqat sizning hisobingizda saqlanadi.
              </p>

              {loading ? (
                <div className="text-center py-8 text-neutral-500 text-sm">Yuklanmoqda...</div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/40">
                  <Key className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400 mb-4">Hali API key qo‘shilmagan</p>
                  <button
                    onClick={() => {
                      setShowForm(true);
                      onProviderChange("groq");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-200 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Key qo‘shish
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-800 bg-neutral-950/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-neutral-100 truncate">
                            {k.name}
                          </span>
                          {k.is_default && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800/80 text-emerald-300">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {k.provider.toUpperCase()} · {k.model}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                          {k.api_key.slice(0, 8)}••••••••
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!k.is_default && (
                          <button
                            onClick={() => setAsDefault(k.id)}
                            title="Asosiy qilish"
                            className="p-1.5 rounded-lg hover:bg-neutral-800 transition text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="p-1.5 rounded-lg hover:bg-red-950/50 transition text-neutral-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      setShowForm(true);
                      onProviderChange("groq");
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-neutral-800 text-sm text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Yangi key qo‘shish
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  AI Provayder
                </label>
                <select
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value as Provider)}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 text-sm bg-neutral-950 text-neutral-100 focus:border-neutral-600 focus:outline-none cursor-pointer"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-neutral-900 text-neutral-100">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key Input with exact placeholder */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-neutral-300">
                    API Key *
                  </label>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Format: {currentProvider.placeholder}
                  </span>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError("");
                  }}
                  placeholder={currentProvider.placeholder}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm font-mono focus:border-neutral-600 focus:outline-none transition"
                />
              </div>

              {/* Model Dropdown + Custom option */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Model *
                </label>
                {currentProvider.models.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={isCustomModel ? "__custom__" : model}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setIsCustomModel(true);
                          setCustomModelName("");
                        } else {
                          setIsCustomModel(false);
                          setModel(e.target.value);
                        }
                      }}
                      className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 text-sm focus:border-neutral-600 focus:outline-none cursor-pointer"
                    >
                      {currentProvider.models.map((m) => (
                        <option key={m.id} value={m.id} className="bg-neutral-900 text-neutral-100">
                          {m.name}
                        </option>
                      ))}
                      <option value="__custom__" className="bg-neutral-900 text-neutral-100">
                        + Boshqa model (Nomini qo‘lda kiritish)...
                      </option>
                    </select>

                    {isCustomModel && (
                      <input
                        value={customModelName}
                        onChange={(e) => setCustomModelName(e.target.value)}
                        placeholder="Model aniq identifikatorini kiriting (masalan: gpt-4o)"
                        className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Model nomini kiriting (masalan: gpt-4o)"
                    className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                  />
                )}
              </div>

              {/* Optional Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Kalit nomi (Ixtiyoriy)
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Masalan: Mening ${currentProvider.label.split(" ")[0]} kalitim`}
                  className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                />
              </div>

              {/* Base URL (for custom or openrouter) */}
              {(provider === "custom" || provider === "openrouter") && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Base URL (API Endpoint)
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full h-11 px-3.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none font-mono text-xs"
                  />
                </div>
              )}

              {/* Is Default Checkbox */}
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-700 bg-neutral-950 text-white focus:ring-0 cursor-pointer"
                />
                Asosiy (Default) kalit sifatida belgilash
              </label>

              {/* Validation Status / Error */}
              {statusMessage && (
                <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-950/40 border border-blue-900/50 px-3.5 py-2.5 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/60 border border-red-900/60 px-3.5 py-2.5 rounded-lg">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                    setStatusMessage("");
                  }}
                  disabled={saving}
                  className="flex-1 h-11 rounded-lg border border-neutral-800 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-11 rounded-lg bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Tekshirilmoqda...
                    </>
                  ) : (
                    "Saqlash"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
