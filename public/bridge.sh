#!/usr/bin/env bash
set -e

echo "=== MR AI Google Cloud Shell Bridge o'rnatilmoqda ==="

# 1. To'xtatish (agar avval ishga tushirilgan bo'lsa)
pkill -f mrai_bridge.py 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true

# 2. Python serverini yaratish
cat << 'PYEOF' > "$HOME/mrai_bridge.py"
import http.server, json, os, subprocess

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/exec':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            cwd = os.path.expanduser('~')
            try:
                data = json.loads(body)
                cmd = data.get('command', '')
                req_cwd = data.get('cwd', '')
                if req_cwd and os.path.isdir(req_cwd):
                    cwd = req_cwd
                trimmed = cmd.strip()
                if trimmed.startswith('cd ') or trimmed == 'cd':
                    target = trimmed[3:].strip() if len(trimmed) > 2 else '~'
                    target_exp = os.path.expanduser(target)
                    new_cwd = os.path.normpath(os.path.join(cwd, target_exp) if not target.startswith('/') else target_exp)
                    if os.path.isdir(new_cwd):
                        cwd = new_cwd
                        out = {'stdout': '', 'stderr': '', 'exit_code': 0, 'cwd': cwd}
                    else:
                        out = {'stdout': '', 'stderr': f'bash: cd: {target}: No such file or directory\n', 'exit_code': 1, 'cwd': cwd}
                else:
                    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=cwd, executable='/bin/bash')
                    out = {'stdout': res.stdout, 'stderr': res.stderr, 'exit_code': res.returncode, 'cwd': cwd}
            except Exception as e:
                out = {'stdout': '', 'stderr': str(e) + '\n', 'exit_code': 1, 'cwd': cwd}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(out).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok', 'server': 'MR AI Cloud Shell Bridge'}).encode('utf-8'))

http.server.HTTPServer(('127.0.0.1', 8080), H).serve_forever()
PYEOF

# 3. Python bridge ni fonda ishga tushirish
python3 "$HOME/mrai_bridge.py" >/dev/null 2>&1 &
echo "[1/2] Mahalliy server 8080-portda ishga tushirildi."

# 4. Cloudflared ni yuklab olish
if [ ! -f "$HOME/cloudflared" ]; then
    echo "[2/2] Cloudflare Tunnel yuklanmoqda..."
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$HOME/cloudflared"
    chmod +x "$HOME/cloudflared"
fi

echo "=========================================================="
echo "Tunnel yoqilmoqda... Quyidagi trycloudflare.com havolasini nusxalang:"
echo "=========================================================="

"$HOME/cloudflared" tunnel --url http://127.0.0.1:8080
