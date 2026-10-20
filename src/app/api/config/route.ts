import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: 'Supabase environment variables are missing' },
      { status: 500 }
    );
  }

  // Anon key is public by design — safe to send to the client
  return NextResponse.json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
}
