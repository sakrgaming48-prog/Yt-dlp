# dler_server.py - Clean version without --no-update-check
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, subprocess, threading, re, os, time
from urllib.parse import urlparse, parse_qs

HOST = '127.0.0.1'
PORT = 8765

YTDLP_DIR = r"D:\a\Files\Apps"
YTDLP_EXE = os.path.join(YTDLP_DIR, "yt-dlp.exe")
OUTDIR = r"D:\p\Downloads"
LOG = os.path.join(OUTDIR, "server_log.txt")

downloads = {}
download_counter = 0

def log(msg):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        print(msg)
    except:
        print(msg)

class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, code=200):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        
        if path == '/queue':
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'downloads': downloads}).encode())
            
        elif path == '/check-update':
            version = check_ytdlp_version()
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'version': version}).encode())
        
        else:
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'msg': 'server running'}).encode())

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length > 0 else '{}'

        try:
            data = json.loads(body) if body else {}
            
            if path == '/download':
                url = data.get("url")
                mode = data.get("mode")
                urls = data.get("urls", [])

                if not mode:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({'status': 'error', 'msg': 'missing mode'}).encode())
                    return

                if urls:
                    download_ids = []
                    for u in urls:
                        if u.strip():
                            did = start_download(u.strip(), mode)
                            download_ids.append(did)
                    
                    self._set_headers(200)
                    self.wfile.write(json.dumps({'status': 'ok', 'msg': f'started {len(download_ids)} downloads', 'download_ids': download_ids}).encode())
                elif url:
                    download_id = start_download(url, mode)
                    self._set_headers(200)
                    self.wfile.write(json.dumps({'status': 'ok', 'msg': 'started', 'download_id': download_id}).encode())
                else:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({'status': 'error', 'msg': 'missing url'}).encode())
            
            elif path == '/update-ytdlp':
                threading.Thread(target=update_ytdlp, daemon=True).start()
                self._set_headers(200)
                self.wfile.write(json.dumps({'status': 'ok', 'msg': 'updating...'}).encode())
            
            else:
                self._set_headers(404)
                self.wfile.write(json.dumps({'status': 'error', 'msg': 'unknown endpoint'}).encode())

        except Exception as e:
            log(f"ERROR: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({'status': 'error', 'msg': str(e)}).encode())

    def do_DELETE(self):
        path = urlparse(self.path).path
        
        if path == '/queue/completed':
            global downloads
            downloads = {k: v for k, v in downloads.items() if v['status'] not in ['completed', 'failed']}
            self._set_headers(200)
            self.wfile.write(json.dumps({'status': 'ok', 'msg': 'cleared'}).encode())
        
        elif path.startswith('/download/'):
            download_id = path.split('/')[-1]
            if download_id in downloads:
                downloads[download_id]['status'] = 'cancelled'
                self._set_headers(200)
                self.wfile.write(json.dumps({'status': 'ok', 'msg': 'cancelled'}).encode())
            else:
                self._set_headers(404)
                self.wfile.write(json.dumps({'status': 'error', 'msg': 'not found'}).encode())

def start_download(url, mode):
    global download_counter
    download_counter += 1
    download_id = f"dl_{download_counter}"
    
    downloads[download_id] = {
        'id': download_id,
        'url': url,
        'mode': mode,
        'status': 'queued',
        'progress': 0,
        'title': 'Loading...',
        'speed': '',
        'eta': '',
        'error': None
    }
    
    threading.Thread(target=run_download, args=(download_id, url, mode), daemon=True).start()
    return download_id

def run_download(download_id, url, mode):
    try:
        downloads[download_id]['status'] = 'downloading'
        
        quality_map = {
            'video1080': ['--no-playlist', '-S', 'res:1080', '--extractor-args', 'youtube:player_client=default'],
            'video720': ['--no-playlist', '-S', 'res:720', '--extractor-args', 'youtube:player_client=default'],
            'video480': ['--no-playlist', '-S', 'res:480', '--extractor-args', 'youtube:player_client=default'],
            'video240': ['--no-playlist', '-S', 'res:240', '--extractor-args', 'youtube:player_client=default'],
            'audio': ['--no-playlist', '-x', '--audio-format', 'mp3', '--extractor-args', 'youtube:player_client=default'],
            'playlist1080': ['-S', 'res:1080', '--extractor-args', 'youtube:player_client=default'],
            'playlist720': ['-S', 'res:720', '--extractor-args', 'youtube:player_client=default'],
            'playlist480': ['-S', 'res:480', '--extractor-args', 'youtube:player_client=default'],
            'playlist_audio': ['-x', '--audio-format', 'mp3', '--extractor-args', 'youtube:player_client=default']
        }
        
        output_template = OUTDIR + r'\%(title)s.%(ext)s'
        if 'playlist' in mode:
            output_template = OUTDIR + r'\%(playlist_title)s\%(title)s.%(ext)s'
        
        cmd = [
            YTDLP_EXE,
            *quality_map.get(mode, ['--no-playlist', '-S', 'res:720', '--extractor-args', 'youtube:player_client=default']),
            '-o', output_template,
            '--newline',
            url
        ]
        
        log(f"Starting download {download_id}: {url}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            cwd=YTDLP_DIR
        )
        
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            
            print(f"[{download_id}] {line}")
            
            if 'Extracting URL' in line or 'Downloading webpage' in line:
                downloads[download_id]['status'] = 'fetching info'
            
            match = re.search(r'\[download\]\s+(\d+\.?\d*)%', line)
            if match:
                progress = float(match.group(1))
                downloads[download_id]['progress'] = progress
                downloads[download_id]['status'] = 'downloading'
            
            match = re.search(r'at\s+([\d.]+\w+/s)', line)
            if match:
                downloads[download_id]['speed'] = match.group(1)
            
            match = re.search(r'ETA\s+([\d:]+)', line)
            if match:
                downloads[download_id]['eta'] = match.group(1)
            
            match = re.search(r'Destination:\s+(.+)', line)
            if match:
                filename = os.path.basename(match.group(1))
                downloads[download_id]['title'] = filename
            
            if 'ExtractAudio' in line:
                downloads[download_id]['status'] = 'converting'
                downloads[download_id]['progress'] = 95
        
        process.wait()
        
        if process.returncode == 0:
            downloads[download_id]['status'] = 'completed'
            downloads[download_id]['progress'] = 100
            log(f"Completed: {download_id}")
        else:
            downloads[download_id]['status'] = 'failed'
            downloads[download_id]['error'] = 'Download failed'
            log(f"Failed: {download_id}")
            
    except Exception as e:
        downloads[download_id]['status'] = 'failed'
        downloads[download_id]['error'] = str(e)
        log(f"Error in {download_id}: {e}")

def check_ytdlp_version():
    try:
        cmd = [YTDLP_EXE, '--version']
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=YTDLP_DIR, timeout=10)
        return result.stdout.strip()
    except:
        return 'unknown'

def update_ytdlp():
    try:
        log("Updating yt-dlp...")
        cmd = [YTDLP_EXE, '-U']
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=YTDLP_DIR, timeout=60)
        log(f"Update result: {result.stdout}")
    except Exception as e:
        log(f"Update failed: {e}")

if __name__ == "__main__":
    log(f"Advanced Server starting on {HOST}:{PORT}")
    version = check_ytdlp_version()
    log(f"yt-dlp version: {version}")
    
    server = HTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    log("Server stopped")