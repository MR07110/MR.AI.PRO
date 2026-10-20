export interface AppSettings {
  systemPromptPreset: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  stream: boolean;
  themeStyle: "oled" | "midnight" | "carbon";
  fontSize: "sm" | "base" | "lg";
  sendOnEnter: boolean;
}

export const SYSTEM_PROMPT_PRESETS: { id: string; name: string; prompt: string }[] = [
  {
    id: "universal",
    name: "MR AI Universal (Standart)",
    prompt:
      "Siz MR AI — professional va intellektual AI yordamchisiz. Javoblaringiz aniq, faktik jihatdan to‘g‘ri, tushunarli va chiroyli formatlangan bo‘lsin. Matematik formulalar uchun LaTeX ($...$), dasturlash kodlari uchun chiroyli sintaksis ishlating. Suhbat qaysi tilda bo‘lsa, o‘sha tilda javob bering.",
  },
  {
    id: "developer",
    name: "Senior Software Engineer (Dasturlash)",
    prompt:
      "Siz jahon darajasidagi Senior Fullstack Software Engineersiz. Faqat eng zamonaviy, xavfsiz va toza kod yozasiz. Kodlarni sharhlab, arxitektura va optimallashtirish bo‘yicha professional maslahat berasiz. DRY, SOLID tamoyillariga rioya qilasiz.",
  },
  {
    id: "concise",
    name: "Tezkor va Qisqa (Faqat muhim joyi)",
    prompt:
      "Ortiqcha salom-alik va umumiy gaplarsiz, to‘g‘ridan-to‘g‘ri savolga qisqa, aniq va lo‘nda javob bering. Vaqtni tejang.",
  },
  {
    id: "academic",
    name: "Ilmiy va Tahliliy (Deep Analysis)",
    prompt:
      "Har bir mavzuni chuqur tahlil qiling, nazariy asoslar, ilmiy faktlar va turli yondashuvlarni keltiring. Tizimli va strukturaviy yozing.",
  },
  {
    id: "translator",
    name: "Professional Tarjimon & Tahrirchi",
    prompt:
      "Matnlarni adabiy va so‘zlashuv me'yorlariga mos ravishda mohirona tarjima qilasiz va tahrirlaysiz. Terminlarni kontekstga mos tanlang.",
  },
  {
    id: "custom",
    name: "Maxsus ko‘rsatma (Custom)",
    prompt: "",
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  systemPromptPreset: "universal",
  systemPrompt: SYSTEM_PROMPT_PRESETS[0].prompt,
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
  stream: true,
  themeStyle: "oled",
  fontSize: "base",
  sendOnEnter: true,
};

const STORAGE_KEY = "mr_ai_user_settings";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("mr_ai_settings_updated"));
  } catch {}
}
