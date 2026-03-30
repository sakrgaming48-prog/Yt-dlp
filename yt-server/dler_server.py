import http.server
import socketserver
import json
import os
import subprocess
import threading
import uuid
import urllib.parse as urlparse
import re
import datetime
import time

PORT = 8765
YTDLP_EXE = r"D:\a\Files\Apps\yt-dlp.exe"
OUTDIR = r"D:\p\Downloads\Random"

if not os.path.exists(OUTDIR):
    os.makedirs(OUTDIR)

downloads = {}
active_processes = {}
queue_lock = threading.Lock() 

def kill_tree(pid):
    try:
        subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def extract_video_id(url):
    match = re.search(r'(?:v=|youtu\.be/|embed/|shorts/)([a-zA-Z0-9_-]{11})', url)
    return match.group(1) if match else None

def check_duplicate(url):
    vid = extract_video_id(url)
    for d in downloads.values():
        # ضفنا "scheduled" لقائمة الحماية لمنع تكرار فيديو مجدول
        if d['status'] in['queued', 'downloading', 'downloading audio', 'converting', 'cancelled', 'scheduled']:
            d_vid = extract_video_id(d['url'])
            if vid and d_vid and vid == d_vid:
                return d['status']
            if url == d['url']:
                return d['status']
    return False

def watchdog(did, process):
    try:
        process.wait(timeout=3600)
    except subprocess.TimeoutExpired:
        kill_tree(process.pid)
        if did in downloads and downloads[did]['status'] not in['completed', 'cancelled']:
            downloads[did]['status'] = 'failed'

def run_download(did, url, mode, start_time=None, end_time=None, subtitles=False):
    if did in downloads: downloads[did]['status'] = 'fetching info'
    
    cmd =[YTDLP_EXE, '--newline', '--no-mtime', '--no-warnings', '-N', '4', '--http-chunk-size', '10M']
    
    # 🔥 ميزة دمج صورة الغلاف دائماً 🔥
    cmd.extend(['--embed-thumbnail'])
    
    # 🔥 ميزة الترجمة التلقائية (لو المستخدم طلبها) 🔥
    if subtitles:
        cmd.extend(['--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,ar.*', '--embed-subs'])
    
    if 'list=' in url:
        cmd.append('--yes-playlist')
        cmd.extend(['-o', os.path.join(OUTDIR, '%(playlist_title)s', '%(playlist_index)s - %(title)s.%(ext)s')])
    else:
        cmd.extend(['-o', os.path.join(OUTDIR, '%(title)s.%(ext)s')])

    if mode == 'audio':
        cmd.extend(['-f', 'bestaudio[ext=m4a]/bestaudio', '--extract-audio', '--audio-format', 'm4a'])
    else:
        height = mode.replace('video', '')
        if not height.isdigit(): height = '720'
        cmd.extend(['-f', f'bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]/best[height<={height}][ext=mp4]/best', '--merge-output-format', 'mp4'])

    if start_time and end_time:
        cmd.extend(['--download-sections', f"*{start_time}-{end_time}", '--force-keyframes-at-cuts'])

    cmd.append(url)
    vid_id = extract_video_id(url) or 'Playlist'
    print(f"\n[+] STARTING: {vid_id}")

    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, encoding='utf-8', errors='replace')
        active_processes[did] = process
        downloads[did]['status'] = 'downloading'
        
        threading.Thread(target=watchdog, args=(did, process), daemon=True).start()

        last_pct = 0
        last_printed_pct = -10
        phase = 1 
        
        for line in process.stdout:
            clean_line = line.strip()
            
            if clean_line and not clean_line.startswith('[download]') and not clean_line.startswith('[youtube]'):
                if 'ExtractAudio' in clean_line or 'Merger' in clean_line:
                    downloads[did]['status'] = 'converting'
            
            if '[download]' in line and '%' in line:
                try:
                    pct_match = re.search(r'([0-9]{1,3}\.[0-9])%', line)
                    if pct_match:
                        pct = float(pct_match.group(1))
                        if pct < last_pct and (last_pct - pct) > 50: phase = 2 
                        last_pct = pct
                        
                        downloads[did]['progress'] = pct
                        if phase == 2: downloads[did]['status'] = 'downloading audio'
                        
                        speed_match = re.search(r'([0-9.]+\wiB/s)', line)
                        eta_match = re.search(r'ETA ([0-9:]+)', line)
                        downloads[did]['speed'] = speed_match.group(1) if speed_match else '--'
                        downloads[did]['eta'] = eta_match.group(1) if eta_match else '--'
                        
                        if pct - last_printed_pct >= 5.0 or pct == 100.0:
                            print(f"[{did}] {pct}% | {downloads[did]['speed']} | ETA: {downloads[did]['eta']}")
                            last_printed_pct = pct
                except Exception: pass

        process.wait()
        
        if process.returncode == 0:
            downloads[did]['status'] = 'completed'
            downloads[did]['progress'] = 100
            print(f"\n[✔] SUCCESS: {vid_id}")
        elif downloads[did]['status'] != 'cancelled':
            downloads[did]['status'] = 'failed'
                
    except Exception as e:
        if downloads.get(did) and downloads[did]['status'] != 'cancelled':
            downloads[did]['status'] = 'failed'
    finally:
        if did in active_processes:
            del active_processes[did]

# 🔥 محرك الجدولة الليلية (يعمل في الخلفية) 🔥
def scheduler_loop():
    last_checked = None
    while True:
        now = datetime.datetime.now().strftime("%H:%M")
        if now != last_checked:
            with queue_lock:
                for did, d in list(downloads.items()):
                    if d['status'] == 'scheduled' and d.get('schedule_time') == now:
                        print(f"\n[⏰] Scheduled task triggered: {did}")
                        d['status'] = 'queued'
                        t = threading.Thread(target=run_download, args=(did, d['url'], d['mode'], d.get('start_time'), d.get('end_time'), d.get('subtitles')))
                        t.daemon = True
                        t.start()
            last_checked = now
        time.sleep(10)

threading.Thread(target=scheduler_loop, daemon=True).start()

class Handler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(200); self._send_cors_headers(); self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.send_response(200); self._send_cors_headers(); self.end_headers()
            self.wfile.write(b"Server is running")
        elif self.path == '/queue':
            self.send_response(200); self._send_cors_headers(); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps(downloads).encode('utf-8'))
        elif self.path == '/outdir':
            self.send_response(200); self._send_cors_headers(); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps({"outdir": OUTDIR}).encode('utf-8'))
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        if self.path == '/update-ytdlp':
            def update_task(): subprocess.run([YTDLP_EXE, '-U'])
            threading.Thread(target=update_task, daemon=True).start()
            self.send_response(200); self._send_cors_headers(); self.end_headers(); return
            
        elif self.path == '/shutdown':
            self.send_response(200); self._send_cors_headers(); self.end_headers()
            print("\n[🔌] Shutting down server gracefully...")
            os._exit(0)
            return
            
        elif self.path.startswith('/resume/'):
            did = self.path.split('/')[-1]
            if did in downloads and downloads[did]['status'] in['cancelled', 'failed', 'scheduled']:
                downloads[did]['status'] = 'queued'
                item = downloads[did]
                t = threading.Thread(target=run_download, args=(did, item['url'], item['mode'], item.get('start_time'), item.get('end_time'), item.get('subtitles')))
                t.daemon = True
                t.start()
            self.send_response(200); self._send_cors_headers(); self.end_headers()
            return

        elif self.path == '/download':
            length = int(self.headers.get('content-length', 0))
            if length == 0: self.send_response(400); self.end_headers(); return
            try: body = json.loads(self.rfile.read(length).decode('utf-8'))
            except Exception: self.send_response(400); self.end_headers(); return
            
            urls = body.get('batch',[])
            if not urls and body.get('url'): urls =[body.get('url')]
                
            mode = body.get('mode', 'video720')
            start_time = body.get('start_time')
            end_time = body.get('end_time')
            subtitles = body.get('subtitles', False)
            schedule_time = body.get('schedule_time')

            if not urls: return
            
            with queue_lock:
                if len(urls) == 1:
                    dup_status = check_duplicate(urls[0])
                    if dup_status:
                        self.send_response(400); self._send_cors_headers(); self.end_headers()
                        self.wfile.write(json.dumps({"error": f"already_{dup_status}"}).encode('utf-8'))
                        return
                
                for url in urls:
                    if not url.strip(): continue
                    if check_duplicate(url): continue
                    
                    did = "dl_" + str(uuid.uuid4())[:8]
                    status = 'scheduled' if schedule_time else 'queued'
                    
                    downloads[did] = {
                        "id": did, "url": url, "mode": mode, "status": status,
                        "progress": 0, "title": url, "speed": "--", "eta": "--",
                        "start_time": start_time, "end_time": end_time,
                        "subtitles": subtitles, "schedule_time": schedule_time
                    }
                    if not schedule_time:
                        t = threading.Thread(target=run_download, args=(did, url, mode, start_time, end_time, subtitles))
                        t.daemon = True
                        t.start()
                
            self.send_response(200); self._send_cors_headers(); self.end_headers()

    def do_DELETE(self):
        if self.path.startswith('/download/'):
            did = self.path.split('/')[-1]
            if did in downloads: downloads[did]['status'] = 'cancelled'
            if did in active_processes: kill_tree(active_processes[did].pid)
            self.send_response(200); self._send_cors_headers(); self.end_headers()
        elif self.path.startswith('/remove/'):
            did = self.path.split('/')[-1]
            if did in active_processes: kill_tree(active_processes[did].pid)
            if did in downloads: del downloads[did]
            self.send_response(200); self._send_cors_headers(); self.end_headers()
        elif self.path == '/queue/completed':
            to_delete =[k for k, v in downloads.items() if v['status'] in['completed', 'cancelled', 'failed']]
            for k in to_delete: del downloads[k]
            self.send_response(200); self._send_cors_headers(); self.end_headers()

if __name__ == '__main__':
    server = socketserver.TCPServer(('', PORT), Handler)
    print(f" ✅ Enterprise Server | Subs & Covers | Scheduler 🌙")
    server.serve_forever()