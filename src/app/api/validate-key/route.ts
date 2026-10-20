import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, model, baseUrl } = await req.json();

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json(
        { valid: false, error: "API key kiritilmadi" },
        { status: 400 }
      );
    }

    const key = apiKey.trim();
    const cleanModel = (model || "").trim();

    // Provider bo'yicha maxsus tekshiruvlar (masalan, Anthropic)
    if (provider === "anthropic") {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: cleanModel || "claude-3-5-sonnet-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
        });

        if (res.status === 200) {
          return NextResponse.json({ valid: true });
        }

        const errText = await res.text();
        let message = `Anthropic xatosi (${res.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) message = parsed.error.message;
        } catch {}

        if (res.status === 401) {
          message = "Anthropic API kaliti noto‘g‘ri (401 Unauthorized)";
        }

        return NextResponse.json({ valid: false, error: message }, { status: 200 });
      } catch (err: any) {
        return NextResponse.json(
          { valid: false, error: `Anthropic serveriga ulanib bo‘lmadi: ${err.message}` },
          { status: 200 }
        );
      }
    }

    // Barcha OpenAI-mos keluvchi provayderlar uchun
    let targetBase = baseUrl ? baseUrl.trim().replace(/\/+$/, "") : "";
    if (!targetBase) {
      targetBase = getDefaultUrl(provider);
    }

    const endpoint = targetBase.endsWith("/chat/completions")
      ? targetBase
      : `${targetBase}/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // OpenRouter uchun qo'shimcha headerlar
          ...(provider === "openrouter"
            ? {
                "HTTP-Referer": "https://mrai-uzbek.vercel.app",
                "X-Title": "MR AI",
              }
            : {}),
        },
        body: JSON.stringify({
          model: cleanModel,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return NextResponse.json({ valid: true });
      }

      const errText = await res.text();
      let errorMsg = `Xatolik: HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg =
          parsed?.error?.message ||
          parsed?.message ||
          parsed?.error ||
          errorMsg;
      } catch {}

      if (res.status === 401) {
        errorMsg = "API kalit noto‘g‘ri yoki yaroqsiz (401 Invalid API Key). Iltimos, kalitni to‘g‘ri nusxalang.";
      } else if (res.status === 403) {
        errorMsg = "Ushbu API kalitga ruxsat berilmagan (403 Forbidden).";
      } else if (res.status === 404) {
        errorMsg = `Model (${cleanModel}) yoki API manzili topilmadi (404). Model nomini tekshiring.`;
      } else if (res.status === 429) {
        if (errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("credit")) {
          errorMsg = "Hisobingizda mablag‘ yoki bepul limit tugagan (Quota exceeded).";
        } else {
          errorMsg = "Juda ko‘p so‘rov yuborildi (429 Rate limit). Biroz kuting.";
        }
      }

      return NextResponse.json({ valid: false, error: errorMsg }, { status: 200 });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return NextResponse.json(
          { valid: false, error: "Provayder serveri javob bermadi (Vaqt tugadi - Timeout)" },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { valid: false, error: `Ulanishda xatolik: ${err.message}` },
        { status: 200 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, error: err.message || "Server xatosi" },
      { status: 500 }
    );
  }
}

function getDefaultUrl(provider: string): string {
  switch (provider) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "xai":
      return "https://api.x.ai/v1";
    case "mistral":
      return "https://api.mistral.ai/v1";
    case "together":
      return "https://api.together.xyz/v1";
    case "perplexity":
      return "https://api.perplexity.ai";
    default:
      return "https://api.openai.com/v1";
  }
}
