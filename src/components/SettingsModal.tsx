"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Key, Check } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserApiKey, Provider } from "@/types";

const PROVIDERS: { value: Provider; label: string; defaultModel: string; defaultUrl?: string }[] = [
  { value: "groq", label: "Groq", defaultModel: "llama-3.3-70b-versatile", defaultUrl: "https://api.groq.com/openai/v1" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o", defaultUrl: "https://api.openai.com/v1" },
  { value: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-20250514", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "custom", label: "Custom (OpenAI-compatible)", defaultModel: "model-name", defaultUrl: "" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [provider, setProvider] = useState<Provider>("groq");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && user) loadKeys();
  }, [open, user]);

  async function loadKeys() {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function onProviderChange(p: Provider) {
    setProvider(p);
    const found = PROVIDERS.find((x) => x.value === p);
    if (found) {
      setModel(found.defaultModel);
      setBaseUrl(found.defaultUrl || "");
      if (!name) setName(found.label + " Key");
    }
  }

  async function handleSave() {
    if (!user || !apiKey.trim() || !model.trim()) {
      setError("API Key va Model majburiy");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const supabase = await getSupabaseBrowserClient();

      // If setting as default, unset others
      if (isDefault) {
        await supabase
          .from("user_api_keys")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      const { error } = await supabase.from("user_api_keys").insert({
        user_id: user.id,
        provider,
        name: name || PROVIDERS.find((p) => p.value === provider)?.label + " Key",
        api_key: apiKey.trim(),
        base_url: baseUrl || null,
        model: model.trim(),
        is_default: isDefault || keys.length === 0,
      });

      if (error) throw error;

      setShowForm(false);
      setApiKey("");
      setName("");
      setIsDefault(false);
      await loadKeys();
    } catch (e: any) {
      setError(e.message || "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu API key o‘chirilsinmi?")) return;
    try {
      const supabase = await getSupabaseBrowserClient();
      await supabase.from("user_api_keys").delete().eq("id", id);
      await loadKeys();
    } catch (e) {
      console.error(e);
    }
  }

  async function setAsDefault(id: string) {
    if (!user) return;
    try {
      const supabase = await getSupabaseBrowserClient();
      await supabase
        .from("user_api_keys")
        .update({ is_default: false })
        .eq("user_id", user.id);
      await supabase
        .from("user_api_keys")
        .update({ is_default: true })
        .eq("id", id);
      await loadKeys();
    } catch (e) {
      console.error(e);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-neutral-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-neutral-700" />
            <h2 className="text-lg font-semibold text-neutral-900">My API Keys</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!showForm ? (
            <>
              <p className="text-sm text-neutral-500 mb-4">
                Istagan provayder va model uchun o‘z API keylaringizni qo‘shing. Kalitlar faqat sizning accountingizda saqlanadi.
              </p>

              {loading ? (
                <div className="text-center py-8 text-neutral-400 text-sm">Yuklanmoqda...</div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-neutral-200 rounded-xl">
                  <Key className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 mb-4">Hali API key qo‘shilmagan</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition"
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
                      className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-150 bg-neutral-50/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-neutral-900 truncate">
                            {k.name}
                          </span>
                          {k.is_default && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-900 text-white">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {k.provider} · {k.model}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5 font-mono">
                          {k.api_key.slice(0, 8)}••••••••
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!k.is_default && (
                          <button
                            onClick={() => setAsDefault(k.id)}
                            title="Default qilish"
                            className="p-1.5 rounded-lg hover:bg-neutral-200 transition text-neutral-500"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Yangi key qo‘shish
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value as Provider)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Nom (ixtiyoriy)
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: My Groq Key"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... yoki gsk_..."
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Model *
                </label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="llama-3.3-70b-versatile"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm"
                />
              </div>

              {(provider === "custom" || provider === "openrouter") && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Base URL
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Default key sifatida belgilash
              </label>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="flex-1 h-10 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
