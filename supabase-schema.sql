-- ============================================
-- MR AI Pro - Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2. Chats
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text default 'Yangi suhbat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.chats enable row level security;

create policy "Users can manage own chats"
  on public.chats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats on delete cascade not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can manage messages of own chats"
  on public.messages for all
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
    )
  );

-- 4. User API Keys (Settings → My API Keys)
create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  provider text not null,          -- groq | openai | openrouter | anthropic | custom
  name text not null,              -- "My Groq Key", "Work OpenAI" ...
  api_key text not null,
  base_url text,                   -- for custom providers
  model text not null,             -- llama-3.3-70b-versatile, gpt-4o, ...
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.user_api_keys enable row level security;

create policy "Users can manage own API keys"
  on public.user_api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: only one default key per user
create unique index if not exists user_api_keys_one_default
  on public.user_api_keys (user_id)
  where is_default = true;

-- 5. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
