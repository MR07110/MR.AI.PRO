import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_SERVER_URL = "https://satisfy-endurance-mooned.ngrok-free.dev";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const serverUrl = req.headers.get("x-server-url") || DEFAULT_SERVER_URL;
    const cleanUrl = serverUrl.replace(/\/+$/, "");

    const res = await fetch(`${cleanUrl}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { stdout: "", stderr: `Serverga ulanish xatosi: ${err.message || "Ulanib bo‘lmadi"}`, exit_code: 1 },
      { status: 200 }
    );
  }
}
