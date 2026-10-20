#!/usr/bin/env bash
set -e

echo "=== MR AI Google Cloud Shell Bridge (SQLite Database Enabled) ==="

# 1. To'xtatish (agar avval ishga tushirilgan bo'lsa)
pkill -f mrai_bridge.py 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true
pkill -f ngrok 2>/dev/null || true

# 2. Python serverini yaratish
cat << 'PYEOF' > "$HOME/mrai_bridge.py"
import http.server, json, os, subprocess, sqlite3, urllib.parse

DB_DIR = os.path.expanduser("~/.mrai")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "mrai.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""")
    cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id)
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        base_url TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )""")
    conn.commit()
    conn.close()

init_db()

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_cors(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_cors(200)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        conn = get_db()
        cur = conn.cursor()

        try:
            if path in ("/", "/health"):
                self.send_cors()
                self.wfile.write(json.dumps({"status": "ok", "server": "MR AI Linux Bridge (SQLite Enabled)"}).encode("utf-8"))
                return

            if path == "/api/db/status":
                cur.execute("SELECT COUNT(*) FROM chats")
                chats_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM messages")
                messages_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM api_keys")
                keys_count = cur.fetchone()[0]
                db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

                self.send_cors()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "chats_count": chats_count,
                    "messages_count": messages_count,
                    "keys_count": keys_count,
                    "db_size": db_size,
                    "db_path": DB_PATH
                }).encode("utf-8"))
                return

            if path == "/api/db/chats":
                cur.execute("SELECT id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC")
                rows = [dict(r) for r in cur.fetchall()]
                self.send_cors()
                self.wfile.write(json.dumps(rows).encode("utf-8"))
                return

            if path == "/api/db/messages":
                chat_id = query.get("chat_id", [""])[0]
                if not chat_id:
                    self.send_cors(400)
                    self.wfile.write(json.dumps({"error": "chat_id is required"}).encode("utf-8"))
                    return
                cur.execute("SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC", (chat_id,))
                rows = [dict(r) for r in cur.fetchall()]
                self.send_cors()
                self.wfile.write(json.dumps(rows).encode("utf-8"))
                return

            if path == "/api/db/keys":
                cur.execute("SELECT id, provider, name, api_key, model, base_url, is_default, created_at FROM api_keys ORDER BY created_at DESC")
                rows = [dict(r) for r in cur.fetchall()]
                for r in rows:
                    r["is_default"] = bool(r["is_default"])
                self.send_cors()
                self.wfile.write(json.dumps(rows).encode("utf-8"))
                return

            if path == "/api/db/export":
                cur.execute("SELECT * FROM chats ORDER BY updated_at DESC")
                chats = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM messages ORDER BY created_at ASC")
                messages = [dict(r) for r in cur.fetchall()]
                cur.execute("SELECT * FROM api_keys ORDER BY created_at DESC")
                keys = [dict(r) for r in cur.fetchall()]
                self.send_cors()
                self.wfile.write(json.dumps({"chats": chats, "messages": messages, "api_keys": keys}).encode("utf-8"))
                return

            self.send_cors(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))
        finally:
            conn.close()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        # Command execution
        if path == "/exec":
            cwd = os.path.expanduser("~")
            try:
                cmd = body.get("command", "")
                req_cwd = body.get("cwd", "")
                if req_cwd and os.path.isdir(req_cwd):
                    cwd = req_cwd
                trimmed = cmd.strip()
                if trimmed.startswith("cd ") or trimmed == "cd":
                    target = trimmed[3:].strip() if len(trimmed) > 2 else "~"
                    target_exp = os.path.expanduser(target)
                    new_cwd = os.path.normpath(os.path.join(cwd, target_exp) if not target.startswith("/") else target_exp)
                    if os.path.isdir(new_cwd):
                        cwd = new_cwd
                        out = {"stdout": "", "stderr": "", "exit_code": 0, "cwd": cwd}
                    else:
                        out = {"stdout": "", "stderr": f"bash: cd: {target}: No such file or directory\n", "exit_code": 1, "cwd": cwd}
                else:
                    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60, cwd=cwd, executable="/bin/bash")
                    out = {"stdout": res.stdout, "stderr": res.stderr, "exit_code": res.returncode, "cwd": cwd}
            except Exception as e:
                out = {"stdout": "", "stderr": str(e) + "\n", "exit_code": 1, "cwd": cwd}
            self.send_cors()
            self.wfile.write(json.dumps(out).encode("utf-8"))
            return

        conn = get_db()
        cur = conn.cursor()
        try:
            if path == "/api/db/chats":
                cid = body.get("id")
                title = body.get("title", "Yangi suhbat")
                created_at = body.get("created_at")
                updated_at = body.get("updated_at") or created_at
                cur.execute("""
                INSERT INTO chats (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    updated_at = excluded.updated_at
                """, (cid, title, created_at, updated_at))
                conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True, "id": cid}).encode("utf-8"))
                return

            if path == "/api/db/messages":
                msgs = body if isinstance(body, list) else [body]
                for m in msgs:
                    mid = m.get("id")
                    chat_id = m.get("chat_id")
                    role = m.get("role", "user")
                    content = m.get("content", "")
                    created_at = m.get("created_at")
                    cur.execute("""
                    INSERT INTO messages (id, chat_id, role, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET content = excluded.content
                    """, (mid, chat_id, role, content, created_at))
                    cur.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (created_at, chat_id))
                conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True, "count": len(msgs)}).encode("utf-8"))
                return

            if path == "/api/db/keys":
                kid = body.get("id")
                provider = body.get("provider", "custom")
                name = body.get("name", "Custom")
                api_key = body.get("api_key", "")
                model = body.get("model", "")
                base_url = body.get("base_url")
                is_default = 1 if body.get("is_default") else 0
                created_at = body.get("created_at")
                if is_default:
                    cur.execute("UPDATE api_keys SET is_default = 0")
                cur.execute("""
                INSERT INTO api_keys (id, provider, name, api_key, model, base_url, is_default, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    provider = excluded.provider,
                    name = excluded.name,
                    api_key = excluded.api_key,
                    model = excluded.model,
                    base_url = excluded.base_url,
                    is_default = excluded.is_default
                """, (kid, provider, name, api_key, model, base_url, is_default, created_at))
                conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True, "id": kid}).encode("utf-8"))
                return

            if path == "/api/db/keys/default":
                kid = body.get("id")
                cur.execute("UPDATE api_keys SET is_default = 0")
                cur.execute("UPDATE api_keys SET is_default = 1 WHERE id = ?", (kid,))
                conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return

            if path == "/api/db/clear":
                cur.execute("DELETE FROM messages")
                cur.execute("DELETE FROM chats")
                conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return

            self.send_cors(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))
        finally:
            conn.close()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        body = self.read_json_body()

        conn = get_db()
        cur = conn.cursor()
        try:
            if path == "/api/db/chats":
                cid = query.get("id", [""])[0] or body.get("id")
                if cid:
                    cur.execute("DELETE FROM messages WHERE chat_id = ?", (cid,))
                    cur.execute("DELETE FROM chats WHERE id = ?", (cid,))
                    conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return

            if path == "/api/db/keys":
                kid = query.get("id", [""])[0] or body.get("id")
                if kid:
                    cur.execute("DELETE FROM api_keys WHERE id = ?", (kid,))
                    conn.commit()
                self.send_cors()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return

            self.send_cors(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))
        finally:
            conn.close()

http.server.HTTPServer(("127.0.0.1", 8080), H).serve_forever()
PYEOF

# 3. Python bridge ni fonda ishga tushirish
python3 "$HOME/mrai_bridge.py" >/dev/null 2>&1 &
echo "[1/2] Mahalliy SQLite ma'lumotlar bazasi va server 8080-portda ishga tushirildi."

# 4. Ngrok yuklab olish va statik 1 URL bilan ulash
if [ ! -f "$HOME/ngrok" ]; then
    echo "[2/2] ngrok yuklanmoqda..."
    curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C "$HOME"
    chmod +x "$HOME/ngrok"
fi

"$HOME/ngrok" config add-authtoken 3IJnbJJy73hkpJpkX8J0ACOOXGh_3QeZyPeDsrf2WsALXA6sp >/dev/null 2>&1 || true

echo "=========================================================="
echo "Doimiy Statik Server yoqildi:"
echo "https://satisfy-endurance-mooned.ngrok-free.dev"
echo "=========================================================="

"$HOME/ngrok" http 8080 --url=satisfy-endurance-mooned.ngrok-free.dev --pooling-enabled
