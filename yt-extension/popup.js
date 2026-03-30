const SERVER = 'http://127.0.0.1:8765';

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer); return resp;
    } catch (e) { clearTimeout(timer); throw e; }
}

async function updateQueue() {
    try {
        const res = await fetchWithTimeout(`${SERVER}/queue`);
        if (!res.ok) return;
        renderQueue(await res.json());
    } catch (err) {
        document.getElementById('queue-container').innerHTML = `<p class="empty-msg" style="color:#f38ba8;">❌ السيرفر مغلق. يرجى تشغيل (YT-dlp-Server.bat)</p>`;
    }
}

function renderQueue(data) {
    const container = document.getElementById('queue-container');
    const keys = Object.keys(data);
    if (keys.length === 0) { container.innerHTML = '<p class="empty-msg">لا يوجد تحميلات حالياً 😴</p>'; return; }

    let html = '';
    keys.forEach(id => {
        const item = data[id];
        let statusText = item.status;
        let color = '#a6e3a1'; 
        
        if(statusText === 'downloading') { statusText = 'تحميل ⏳'; color = '#f9e2af'; }
        else if(statusText === 'downloading audio') { statusText = 'صوت 🎵'; color = '#89b4fa'; }
        else if(statusText === 'queued') { statusText = 'انتظار ⏱'; color = '#cdd6f4'; }
        else if(statusText === 'completed') { statusText = 'مكتمل ✅'; color = '#a6e3a1'; }
        else if(statusText === 'failed') { statusText = 'فشل ❌'; color = '#f38ba8'; }
        else if(statusText === 'converting') { statusText = 'معالجة 🔄'; color = '#cba6f7'; }
        else if(statusText === 'cancelled') { statusText = 'مؤقت ⏸️'; color = '#f38ba8'; }

        const isPlaylist = item.url.includes('list=') ? '📑' : '🎬';

        let actionButtons = '';
        if (['downloading', 'downloading audio', 'queued', 'converting'].includes(item.status)) {
            actionButtons = `<button class="action-btn" data-id="${id}" data-action="pause" title="إيقاف مؤقت">⏸️</button>`;
        } else if (['cancelled', 'failed'].includes(item.status)) {
            actionButtons = `<button class="action-btn" data-id="${id}" data-action="resume" title="استئناف">▶️</button>`;
        }
        actionButtons += `<button class="action-btn" data-id="${id}" data-action="remove" title="حذف">❌</button>`;

        html += `
        <div class="dl-item">
            <div class="btn-group">${actionButtons}</div>
            <div class="dl-title" title="${item.title}">${isPlaylist} ${item.title}</div>
            <div class="dl-info">
                <span class="status-badge" style="background:${color}">${statusText}</span>
                <span>${item.speed} | وقت: ${item.eta}</span>
                <span style="font-weight:bold; color:${color};">${item.progress}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${item.progress}%; background: ${color};"></div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

document.getElementById('queue-container').addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;
    
    // 🔥 تجميد الزرار بصرياً عشان ميضغطش مرتين 🔥
    if(btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '⏳';
    
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    
    if (action === 'pause') { await fetchWithTimeout(`${SERVER}/download/${id}`, { method: 'DELETE' }); }
    else if (action === 'resume') { await fetchWithTimeout(`${SERVER}/resume/${id}`, { method: 'POST' }); }
    else if (action === 'remove') { await fetchWithTimeout(`${SERVER}/remove/${id}`, { method: 'DELETE' }); }
});

document.getElementById('clear-btn').addEventListener('click', async () => { await fetchWithTimeout(`${SERVER}/queue/completed`, { method: 'DELETE' }); updateQueue(); });

document.getElementById('open-folder-btn').addEventListener('click', async () => { 
    try { await fetch(`${SERVER}/open-folder`); } 
    catch(e) { alert('❌ السيرفر لا يستجيب! تأكد من تشغيله.'); } 
});

document.getElementById('update-btn').addEventListener('click', async () => { 
    try { 
        const btn = document.getElementById('update-btn');
        btn.style.opacity = '0.5';
        await fetch(`${SERVER}/update-ytdlp`, { method: 'POST' });
        alert('✅ تم إرسال أمر التحديث للسيرفر بنجاح!\nيرجى متابعة الشاشة السوداء لمعرفة وقت الانتهاء.');
        btn.style.opacity = '1';
    } catch(e) { alert('❌ السيرفر مغلق أو لا يستجيب!'); } 
});

document.getElementById('batch-submit').addEventListener('click', async () => {
    const text = document.getElementById('batch-urls').value;
    const quality = document.getElementById('batch-quality').value;
    if (!text.trim()) return;
    const urls = text.split('\n').map(u => u.trim()).filter(u => u.length > 5);
    if (urls.length === 0) return;

    try {
        await fetchWithTimeout(`${SERVER}/download`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch: urls, mode: quality })
        });
        document.getElementById('batch-urls').value = '';
        updateQueue();
    } catch(e) { alert("السيرفر لا يعمل!"); }
});

setInterval(updateQueue, 200); updateQueue();
document.getElementById('shutdown-btn').addEventListener('click', async () => { 
    if(confirm('هل تريد إغلاق السيرفر في الخلفية تماماً؟')) {
        try { await fetch(`${SERVER}/shutdown`, { method: 'POST' }); } catch(e) {}
        window.close();
    }
});