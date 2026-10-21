import { Chat, Message, UserApiKey } from '@/types';
import { loadSettings } from '@/lib/settings';

const DB_NAME = 'mrai_local_store';
const DB_VERSION = 1;
const STORE_CHATS = 'chats';
const STORE_MESSAGES = 'messages';
const STORE_KEYS = 'api_keys';

// Open native browser IndexedDB
function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CHATS)) {
        const chatStore = db.createObjectStore(STORE_CHATS, { keyPath: 'id' });
        chatStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('chat_id', 'chat_id', { unique: false });
        msgStore.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getServerUrl(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mrai_server_url');
      if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    }
    const settings = loadSettings();
    if (settings && (settings as any).serverUrl && (settings as any).serverUrl.trim()) {
      return (settings as any).serverUrl.trim().replace(/\/+$/, '');
    }
  } catch {}
  return 'https://satisfy-endurance-mooned.ngrok-free.dev';
}

const NGROK_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': '1',
  'Authorization': 'Bearer 3ea3e345de68425a3ec13279117ff7c4fbbea67a9634f28ee8865c4475b6ef96',
};

// -------------------------------------------------------------
// CHATS
// -------------------------------------------------------------
export async function getChats(): Promise<Chat[]> {
  const serverUrl = getServerUrl();
  if (serverUrl) {
    try {
      const res = await fetch(`${serverUrl}/api/db/chats`, {
        headers: NGROK_HEADERS,
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const serverChats: Chat[] = await res.json();
        if (Array.isArray(serverChats)) {
          // Sync to local IDB in background
          try {
            const db = await openLocalDb();
            const tx = db.transaction(STORE_CHATS, 'readwrite');
            const store = tx.objectStore(STORE_CHATS);
            for (const c of serverChats) {
              store.put(c);
            }
          } catch {}
          return serverChats;
        }
      }
    } catch {}
  }

  // Fallback to local IndexedDB
  try {
    const db = await openLocalDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CHATS, 'readonly');
      const store = tx.objectStore(STORE_CHATS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: Chat[] = req.result || [];
        items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function createChat(title: string): Promise<Chat> {
  const now = new Date().toISOString();
  const newChat: Chat = {
    id: crypto.randomUUID(),
    user_id: 'mrqosimov2011',
    title: title.slice(0, 50).trim() || 'Yangi suhbat',
    created_at: now,
    updated_at: now,
  };

  // 1. Save to local IDB immediately
  try {
    const db = await openLocalDb();
    const tx = db.transaction(STORE_CHATS, 'readwrite');
    tx.objectStore(STORE_CHATS).put(newChat);
  } catch {}

  // 2. Sync to server SQLite
  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/chats`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: JSON.stringify(newChat),
    }).catch(() => {});
  }

  return newChat;
}

export async function updateChatTitle(id: string, title: string): Promise<void> {
  const cleanTitle = title.trim();
  const now = new Date().toISOString();

  try {
    const db = await openLocalDb();
    const tx = db.transaction(STORE_CHATS, 'readwrite');
    const store = tx.objectStore(STORE_CHATS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const updated = { ...getReq.result, title: cleanTitle, updated_at: now };
        store.put(updated);
      }
    };
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/chats`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: JSON.stringify({ id, title: cleanTitle, updated_at: now }),
    }).catch(() => {});
  }
}

export async function deleteChat(id: string): Promise<void> {
  try {
    const db = await openLocalDb();
    const tx = db.transaction([STORE_CHATS, STORE_MESSAGES], 'readwrite');
    tx.objectStore(STORE_CHATS).delete(id);

    // Delete associated messages locally
    const msgStore = tx.objectStore(STORE_MESSAGES);
    const index = msgStore.index('chat_id');
    const req = index.getAllKeys(id);
    req.onsuccess = () => {
      for (const key of req.result) {
        msgStore.delete(key);
      }
    };
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/chats?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }
}

export async function deleteAllChats(): Promise<void> {
  try {
    const db = await openLocalDb();
    const tx = db.transaction([STORE_CHATS, STORE_MESSAGES], 'readwrite');
    tx.objectStore(STORE_CHATS).clear();
    tx.objectStore(STORE_MESSAGES).clear();
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/clear`, {
      method: 'POST',
    }).catch(() => {});
  }
}

// -------------------------------------------------------------
// MESSAGES
// -------------------------------------------------------------
export async function getMessages(chatId: string): Promise<Message[]> {
  const serverUrl = getServerUrl();
  if (serverUrl) {
    try {
      const res = await fetch(`${serverUrl}/api/db/messages?chat_id=${encodeURIComponent(chatId)}`, {
        headers: NGROK_HEADERS,
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const serverMsgs: Message[] = await res.json();
        if (Array.isArray(serverMsgs)) {
          // Sync into local IDB in background
          try {
            const db = await openLocalDb();
            const tx = db.transaction(STORE_MESSAGES, 'readwrite');
            const store = tx.objectStore(STORE_MESSAGES);
            for (const m of serverMsgs) {
              store.put(m);
            }
          } catch {}
          return serverMsgs;
        }
      }
    } catch {}
  }

  // Fallback to local IDB
  try {
    const db = await openLocalDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const index = tx.objectStore(STORE_MESSAGES).index('chat_id');
      const req = index.getAll(chatId);
      req.onsuccess = () => {
        const list: Message[] = req.result || [];
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveMessage(
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  customId?: string
): Promise<Message> {
  const now = new Date().toISOString();
  const msg: Message = {
    id: customId || crypto.randomUUID(),
    chat_id: chatId,
    role,
    content,
    created_at: now,
  };

  // 1. Save to local IDB
  try {
    const db = await openLocalDb();
    const tx = db.transaction([STORE_MESSAGES, STORE_CHATS], 'readwrite');
    tx.objectStore(STORE_MESSAGES).put(msg);

    // Update parent chat updated_at
    const chatStore = tx.objectStore(STORE_CHATS);
    const chatReq = chatStore.get(chatId);
    chatReq.onsuccess = () => {
      if (chatReq.result) {
        chatStore.put({ ...chatReq.result, updated_at: now });
      }
    };
  } catch {}

  // 2. Sync to server SQLite
  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/messages`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: JSON.stringify(msg),
    }).catch(() => {});
  }

  return msg;
}

// -------------------------------------------------------------
// API KEYS
// -------------------------------------------------------------
export async function getKeys(): Promise<UserApiKey[]> {
  const serverUrl = getServerUrl();
  if (serverUrl) {
    try {
      const res = await fetch(`${serverUrl}/api/db/keys`, {
        headers: NGROK_HEADERS,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const keys: UserApiKey[] = await res.json();
        if (Array.isArray(keys)) {
          // Sync into local IDB
          try {
            const db = await openLocalDb();
            const tx = db.transaction(STORE_KEYS, 'readwrite');
            const store = tx.objectStore(STORE_KEYS);
            for (const k of keys) {
              store.put(k);
            }
          } catch {}
          return keys;
        }
      }
    } catch {}
  }

  // Fallback to local IDB
  try {
    const db = await openLocalDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_KEYS, 'readonly');
      const req = tx.objectStore(STORE_KEYS).getAll();
      req.onsuccess = () => {
        const list: UserApiKey[] = req.result || [];
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveKey(
  item: Omit<UserApiKey, 'id' | 'created_at' | 'user_id'> & { id?: string; user_id?: string }
): Promise<UserApiKey> {
  const now = new Date().toISOString();
  const key: UserApiKey = {
    id: item.id || crypto.randomUUID(),
    user_id: 'mrqosimov2011',
    provider: item.provider,
    name: item.name,
    api_key: item.api_key,
    model: item.model,
    base_url: item.base_url || null,
    is_default: Boolean(item.is_default),
    created_at: now,
  };

  try {
    const db = await openLocalDb();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    const store = tx.objectStore(STORE_KEYS);
    if (key.is_default) {
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        for (const k of allReq.result || []) {
          if (k.is_default) store.put({ ...k, is_default: false });
        }
        store.put(key);
      };
    } else {
      store.put(key);
    }
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/keys`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: JSON.stringify(key),
    }).catch(() => {});
  }

  return key;
}

export async function setDefaultKey(id: string): Promise<void> {
  try {
    const db = await openLocalDb();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    const store = tx.objectStore(STORE_KEYS);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const k of req.result || []) {
        store.put({ ...k, is_default: k.id === id });
      }
    };
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/keys/default`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }
}

export async function deleteKey(id: string): Promise<void> {
  try {
    const db = await openLocalDb();
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    tx.objectStore(STORE_KEYS).delete(id);
  } catch {}

  const serverUrl = getServerUrl();
  if (serverUrl) {
    fetch(`${serverUrl}/api/db/keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }
}

// -------------------------------------------------------------
// STATS & EXPORT
// -------------------------------------------------------------
export async function getDataStats(): Promise<{ chatsCount: number; messagesCount: number; dbSize?: number }> {
  const serverUrl = getServerUrl();
  if (serverUrl) {
    try {
      const res = await fetch(`${serverUrl}/api/db/status`, {
        headers: NGROK_HEADERS,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          chatsCount: data.chats_count || 0,
          messagesCount: data.messages_count || 0,
          dbSize: data.db_size,
        };
      }
    } catch {}
  }

  try {
    const db = await openLocalDb();
    const tx = db.transaction([STORE_CHATS, STORE_MESSAGES], 'readonly');
    const cCount = await new Promise<number>((r) => {
      const req = tx.objectStore(STORE_CHATS).count();
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(0);
    });
    const mCount = await new Promise<number>((r) => {
      const req = tx.objectStore(STORE_MESSAGES).count();
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(0);
    });
    return { chatsCount: cCount, messagesCount: mCount };
  } catch {
    return { chatsCount: 0, messagesCount: 0 };
  }
}
