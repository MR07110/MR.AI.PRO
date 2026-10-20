export type Provider =
  | 'groq'
  | 'deepseek'
  | 'openai'
  | 'gemini'
  | 'openrouter'
  | 'anthropic'
  | 'xai'
  | 'mistral'
  | 'together'
  | 'perplexity'
  | 'custom'
  | string;

export interface UserApiKey {
  id: string;
  user_id: string;
  provider: Provider;
  name: string;
  api_key: string;
  base_url?: string | null;
  model: string;
  is_default: boolean;
  created_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}
