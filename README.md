# MR AI Pro (Modern)

Professional AI chat application with user-owned API keys.

## Features

- Clean light UI (ChatGPT / Claude style)
- Supabase Auth + Database
- **Settings → My API Keys** — user can add any provider (Groq, OpenAI, OpenRouter, Anthropic, Custom)
- Keys stored in the user's account (Supabase table)
- Streaming responses
- Chat history

## Vercel Environment Variables (exactly as in your screenshot)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

No `NEXT_PUBLIC_` prefix needed — the app uses `/api/config` to safely expose the public anon key.

## Setup

1. **Supabase**
   - Create a project
   - Go to SQL Editor → paste and run `supabase-schema.sql`

2. **Local**
   ```bash
   cd mrai-next
   npm install
   npm run dev
   ```

3. **Vercel**
   - Push the repo
   - Add the two env vars above
   - Deploy

## How users add keys

After login → click **Settings** → **My API Keys** → add provider + model + API key.
