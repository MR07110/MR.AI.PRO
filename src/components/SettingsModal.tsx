"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Check, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserApiKey, Provider } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDERS: { value: Provider; label: string; defaultModel: string; placeholder: string }[] = [
  { value: "groq", label: "Groq (Eng tez, bepul limitlar)", defaultModel: "llama-3.3-70b-versatile", placeholder: "gsk_..." },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o", placeholder: "sk-proj-..." },
  { value: "openrouter", label: "OpenRouter (Barcha modellar)", defaultModel: "anthropic/claude-3.5-sonnet", placeholder: "sk-or-v1-..." },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-sonnet-20241022", placeholder: "sk-ant-..." },
  { value: "custom", label: "Custom / Boshqa", defaultModel: "", placeholder: "API key" },
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
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    const found = PROVIDERS.find((x) => x.value === p);
    if (found) {
      setModel(found.defaultModel);
      if (p === "groq") setBaseUrl("https://api.groq.com/openai/v1");
      else if (p === "openai") setBaseUrl("https://api.openai.com/v1");
      else if (p === "openrouter") setBaseUrl("https://openrouter.ai/api/v1");
      else if (p === "anthropic") setBaseUrl("https://api.anthropic.com/v1");
      else setBaseUrl("");
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setError("API key kiritilishi shart");
      return;
    }
    if (!model.trim()) {
      setError("Model nomi kiritilishi shart");
      return;
    }

    setSaving(true);
    setError("");

    const supabase = await getSupabaseBrowserClient();

    // Agar bu birinchi key bo‘lsa yoki isDefault belgilangan bo‘lsa
    const shouldBeDefault = isDefault || keys.length === 0;

    if (shouldBeDefault) {
      // Boshqa barcha defaultlarni false qilamiz
      await supabase
        .from("user_api_keys")
        .update({ is_default: false })
        .eq("user_id", user?.id);
    }

    const { error: insertError } = await supabase.from("user_api_keys").insert({
      user_id: user?.id,
      provider,
      name: name.trim() || `${provider.toUpperCase()} (${model})`,
      api_key: apiKey.trim(),
      model: model.trim(),
      base_url: baseUrl.trim() || null,
      is_default: shouldBeDefault,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // Reset form
    setName("");
    setApiKey("");
    setIsDefault(false);
    setShowForm(false);
    setSaving(false);
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

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
                Istagan provayder va model uchun o‘z API keylaringizni qo‘shing. Kalitlar faqat sizning accountingizda saqlanadi.
              </p>

              {loading ? (
                <div className="text-center py-8 text-neutral-500 text-sm">Yuklanmoqda...</div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/40">
                  <Key className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400 mb-4">Hali API key qo‘shilmagan</p>
                  <button
                    onClick={() => setShowForm(true)}
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
                          {k.provider} · {k.model}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                          {k.api_key.slice(0, 8)}••••••••
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!k.is_default && (
                          <button
                            onClick={() => setAsDefault(k.id)}
                            title="Default qilish"
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
                    onClick={() => setShowForm(true)}
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
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => onProviderChange(e.target.value as Provider)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-800 text-sm bg-neutral-950 text-neutral-100 focus:border-neutral-600 focus:outline-none cursor-pointer"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-neutral-900 text-neutral-100">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Nom (ixtiyoriy)
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: My Groq Key"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... yoki gsk_..."
                  className="w-full h-10 px-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm font-mono focus:border-neutral-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Model *
                </label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="llama-3.3-70b-versatile"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                />
              </div>

              {(provider === "custom" || provider === "openrouter") && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Base URL
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full h-10 px-3 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus:outline-none"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-950 text-white focus:ring-0"
                />
                Default key sifatida belgilash
              </label>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="flex-1 h-10 rounded-lg border border-neutral-800 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50 cursor-pointer"
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
