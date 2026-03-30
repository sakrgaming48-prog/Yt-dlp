const SERVER_URL = 'http://127.0.0.1:8765';
let currentStatus = null; 
let isExpanded = false;
let lastBadgeCount = -1; 

const style = document.createElement('style');
style.innerHTML = `
    @keyframes windIdle { 0% { transform: translate(0, 0) rotate(0deg); } 33% { transform: translate(2px, -4px) rotate(2deg); } 66% { transform: translate(-2px, 2px) rotate(-1deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
    @keyframes badgePop { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
    @keyframes badgeDecrease { 0% { transform: scale(1); background-color: #a6e3a1; color: #11111b; border-color: #11111b; } 50% { transform: scale(1.4); background-color: #a6e3a1; color: #11111b; border-color: #11111b; } 100% { transform: scale(1); background-color: #e64553; color: white; border-color: #fff; } }
    @keyframes shakeBtn { 0% { transform: translateX(0); } 25% { transform: translateX(-6px) rotate(-5deg); } 50% { transform: translateX(6px) rotate(5deg); } 75% { transform: translateX(-6px) rotate(-5deg); } 100% { transform: translateX(0); } }
    
    .shake-animation { animation: shakeBtn 0.4s ease-in-out !important; }
    .badge-pop { animation: badgePop 0.3s ease-out; }
    .badge-decrease { animation: badgeDecrease 0.5s ease-out; }
    
    #ytdlp-master-wrapper { position: fixed; z-index: 999999; will-change: left, top; user-select: none; }
    
    #ytdlp-morph-box {
        font-family: 'Segoe UI', Arial, sans-serif; direction: rtl;
        transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        box-shadow: 0 8px 25px rgba(0,0,0,0.5); overflow: hidden !important; position: relative;
    }
    
    #ytdlp-morph-box.collapsed {
        width: 60px !important; height: 60px !important; border-radius: 50% !important;
        background: linear-gradient(135deg, #007bff, #00d2ff);
        cursor: grab; display: flex; align-items: center; justify-content: center;
        animation: windIdle 4s ease-in-out infinite;
    }
    #ytdlp-master-wrapper:active #ytdlp-morph-box.collapsed { cursor: grabbing; box-shadow: 0 4px 10px rgba(0, 123, 255, 0.4); }
    
    /* 🔥 طول اللوحة زاد لـ 550 عشان يستوعب الإضافات الجديدة بسلاسة 🔥 */
    #ytdlp-morph-box.expanded {
        width: 330px !important; height: 550px !important; border-radius: 16px !important;
        background: rgba(24, 24, 37, 0.95); border: 1px solid rgba(137, 180, 250, 0.3);
        backdrop-filter: blur(15px); cursor: grab; display: flex; flex-direction: column; animation: none;
    }
    
    .ytdlp-badge {
        position: absolute; top: -6px; right: -6px; background: #e64553; color: white;
        border-radius: 50%; min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box;
        font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5); border: 2px solid #fff; 
        z-index: 10000; transition: transform 0.3s;
    }
    .expanded-mode .ytdlp-badge { transform: scale(1.15) translate(-5px, 5px); border-color: #1e1e2e; }
    
    #ytdlp-ball-content {
        transition: opacity 0.2s; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        color: white; font-weight: bold; font-size: 13px; text-align: center; white-space: nowrap;
    }
    .expanded #ytdlp-ball-content { opacity: 0; pointer-events: none; position: absolute; }
    
    #ytdlp-panel-content {
        opacity: 0; visibility: hidden; transition: opacity 0.1s ease-out, visibility 0s 0.1s; 
        display: flex; flex-direction: column; height: 100%; padding: 18px; box-sizing: border-box; cursor: default; 
    }
    .expanded #ytdlp-panel-content { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 0.4s 0.3s ease-in, visibility 0s; }
    
    #ytdlp-panel-content input, #ytdlp-panel-content select { user-select: auto; cursor: text; }
    #ytdlp-panel-content select { cursor: pointer; }
    
    #ytdlp-queue-section { flex: 1; overflow-y: auto; padding-right: 5px; }
    #ytdlp-queue-section::-webkit-scrollbar { width: 5px; }
    #ytdlp-queue-section::-webkit-scrollbar-thumb { background: #45475a; border-radius: 4px; }

    .ytdlp-dl-item { background: #181825; border: 1px solid #313244; padding: 12px; border-radius: 10px; margin-bottom: 10px; position: relative; }
    .ytdlp-dl-title { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 10px; padding-left: 65px; color: #f3f3f3; }
    .ytdlp-dl-info { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #bac2de; margin-bottom: 8px; background: #11111b; padding: 5px 8px; border-radius: 6px; }
    .ytdlp-progress-bg { width: 100%; background: #313244; border-radius: 6px; height: 8px; overflow: hidden; }
    .ytdlp-progress-fill { height: 100%; width: 0%; transition: width 0.2s linear; }
    .ytdlp-status { font-size: 10px; padding: 3px 6px; border-radius: 4px; color: #11111b; font-weight: bold; }
    .ytdlp-btn-group { position: absolute; top: 10px; left: 10px; display: flex; gap: 5px; }
    .ytdlp-action-btn { background: #313244; color: white; border: none; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer; transition: 0.2s; }
    .ytdlp-action-btn:hover { background: #45475a; transform: scale(1.1); }
    .ytdlp-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;
document.head.appendChild(style);

function extractVidId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

function injectUI() {
    if (!window.location.pathname.includes('/watch') && !window.location.pathname.includes('/playlist')) {
        const existing = document.getElementById('ytdlp-master-wrapper');
        if (existing) existing.remove();
        return;
    }
    if (document.getElementById('ytdlp-master-wrapper')) return;

    const masterWrapper = document.createElement('div');
    masterWrapper.id = 'ytdlp-master-wrapper';
    masterWrapper.style.left = '50px';
    masterWrapper.style.top = (window.innerHeight - 120) + 'px'; 

    masterWrapper.innerHTML = `
        <div id="ytdlp-badge" class="ytdlp-badge" style="display:none;"></div>
        
        <div id="ytdlp-morph-box" class="collapsed">
            <div id="ytdlp-ball-content">
                <span id="ytdlp-ball-text">⬇️</span>
            </div>
            
            <div id="ytdlp-panel-content">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #313244; padding-bottom:10px; margin-bottom:15px; cursor:grab;" id="ytdlp-drag-handle">
                    <h3 style="margin:0; font-size:15px; color:#89b4fa; pointer-events:none;">🚀 إدارة التحميلات</h3>
                    <button id="ytdlp-close-panel" style="background:none; border:none; color:#f38ba8; cursor:pointer; font-size:16px; font-weight:bold;">✖</button>
                </div>
                
                <div id="ytdlp-new-download-section">
                    <div style="display:flex; gap:5px; margin-bottom:10px;">
                        <select id="ytdlp-quality" style="flex:2; padding:8px; border-radius:6px; background:#313244; color:#fff; border:none; outline:none; font-size:11px;">
                            <option value="audio">صوت (M4A) ⚡</option>
                            <option value="video144">فيديو 144p</option>
                            <option value="video240">فيديو 240p</option>
                            <option value="video480">فيديو 480p</option>
                            <option value="video720" selected>فيديو 720p ✨</option>
                            <option value="video1080">فيديو 1080p 🎬</option>
                        </select>
                        <label style="flex:1; font-size:10px; display:flex; align-items:center; justify-content:center; background:#313244; border-radius:6px; cursor:pointer; color:#bac2de;">
                            <input type="checkbox" id="ytdlp-is-playlist" style="margin-left:3px;"> قايمة
                        </label>
                        <label style="flex:1; font-size:10px; display:flex; align-items:center; justify-content:center; background:#313244; border-radius:6px; cursor:pointer; color:#bac2de;" title="تنزيل الترجمة ودمجها">
                            <input type="checkbox" id="ytdlp-subtitles" style="margin-left:3px;"> ترجمة
                        </label>
                    </div>
                    
                    <div style="display:flex; gap:5px; margin-bottom:10px;">
                        <label style="flex:1; font-size:11px; display:flex; align-items:center; justify-content:center; background:#313244; border-radius:6px; cursor:pointer; color:#bac2de;">
                            <input type="checkbox" id="ytdlp-is-scheduled" style="margin-left:3px;"> ⏰ جدولة
                        </label>
                        <input type="time" id="ytdlp-schedule-time" style="flex:2; padding:6px; border-radius:6px; background:#313244; color:#fff; border:none; font-size:12px; text-align:center; opacity:0.5;" disabled>
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                        <input type="text" id="ytdlp-start" placeholder="قص من 00:00" style="width:48%; padding:6px; border-radius:6px; background:#313244; color:#fff; border:none; font-size:11px; text-align:center;">
                        <input type="text" id="ytdlp-end" placeholder="إلى 05:00" style="width:48%; padding:6px; border-radius:6px; background:#313244; color:#fff; border:none; font-size:11px; text-align:center;">
                    </div>
                    <button id="ytdlp-submit" style="width:100%; padding:10px; background:linear-gradient(135deg, #a6e3a1, #94e2d5); color:#11111b; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; transition:0.2s;">ابدأ التحميل 🚀</button>
                </div>
                
                <hr style="border: 0; height: 1px; background: #45475a; margin: 15px 0;">
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:13px; color:#cdd6f4; font-weight:bold;">قائمة المهام 📥</span>
                    <button id="ytdlp-clear-btn" style="background:none; border:none; color:#f38ba8; cursor:pointer; font-size:11px;">مسح المكتمل 🧹</button>
                </div>
                
                <div id="ytdlp-queue-section"></div>
            </div>
        </div>
    `;

    document.body.appendChild(masterWrapper);
    const morphBox = document.getElementById('ytdlp-morph-box');

    // تفعيل/تعطيل وقت الجدولة
    document.getElementById('ytdlp-is-scheduled').addEventListener('change', (e) => {
        const timeInput = document.getElementById('ytdlp-schedule-time');
        timeInput.disabled = !e.target.checked;
        timeInput.style.opacity = e.target.checked ? '1' : '0.5';
    });

    let hasMoved = false; let isDragging = false;
    let startX, startY, currentX = 50, currentY = window.innerHeight - 120;
    let velX = 0, velY = 0; let lastMouseX, lastMouseY; let physicsFrame;

    function applyPhysics() {
        if (isDragging) return;
        let friction = isExpanded ? 0.75 : 0.92;
        velX *= friction; velY *= friction; 
        currentX += velX; currentY += velY;
        let rect = morphBox.getBoundingClientRect(); 
        let bounceFactor = isExpanded ? -0.3 : -0.7; 
        
        if (currentX < 10) { currentX = 10; velX *= bounceFactor; }
        if (currentY < 10) { currentY = 10; velY *= bounceFactor; }
        if (currentX + rect.width > window.innerWidth - 10) { currentX = window.innerWidth - rect.width - 10; velX *= bounceFactor; }
        if (currentY + rect.height > window.innerHeight - 10) { currentY = window.innerHeight - rect.height - 10; velY *= bounceFactor; }

        masterWrapper.style.left = currentX + 'px'; masterWrapper.style.top = currentY + 'px';
        if (Math.abs(velX) > 0.1 || Math.abs(velY) > 0.1) { physicsFrame = requestAnimationFrame(applyPhysics); } 
    }

    masterWrapper.onmousedown = (e) => {
        const ignoreTags =['INPUT', 'SELECT', 'OPTION', 'BUTTON'];
        if (isExpanded && ignoreTags.includes(e.target.tagName)) return;
        if (isExpanded && e.target.closest('#ytdlp-queue-section')) return;

        e.preventDefault(); 
        isDragging = true; hasMoved = false; cancelAnimationFrame(physicsFrame); 
        
        let rect = masterWrapper.getBoundingClientRect(); 
        currentX = rect.left; currentY = rect.top;
        startX = e.clientX - currentX; startY = e.clientY - currentY; 
        lastMouseX = e.clientX; lastMouseY = e.clientY;
        
        document.onmousemove = (eMove) => {
            if (!isDragging) return;
            let dx = eMove.clientX - lastMouseX; let dy = eMove.clientY - lastMouseY;
            if (Math.abs(eMove.clientX - (currentX + startX)) > 5 || Math.abs(eMove.clientY - (currentY + startY)) > 5) hasMoved = true;
            let throwPower = isExpanded ? 0.4 : 0.8;
            velX = dx * throwPower; velY = dy * throwPower; 
            currentX = eMove.clientX - startX; currentY = eMove.clientY - startY;
            masterWrapper.style.left = currentX + 'px'; masterWrapper.style.top = currentY + 'px';
            lastMouseX = eMove.clientX; lastMouseY = eMove.clientY;
        };
        
        document.onmouseup = () => {
            document.onmousemove = null; document.onmouseup = null;
            if (!isDragging) return;
            isDragging = false;
            
            if (!hasMoved && !isExpanded) {
                isExpanded = true;
                masterWrapper.classList.add('expanded-mode');
                morphBox.classList.remove('collapsed');
                morphBox.classList.add('expanded');
                
                let currentRect = morphBox.getBoundingClientRect();
                if(currentRect.top + 550 > window.innerHeight) {
                    currentY = window.innerHeight - 570;
                    masterWrapper.style.top = currentY + 'px';
                }
            } else { applyPhysics(); }
        };
    };

    document.getElementById('ytdlp-close-panel').addEventListener('click', (e) => {
        e.stopPropagation(); isExpanded = false;
        masterWrapper.classList.remove('expanded-mode');
        morphBox.classList.remove('expanded'); morphBox.classList.add('collapsed');
    });

    document.getElementById('ytdlp-panel-content').addEventListener('click', async (e) => {
        const submitBtn = e.target.closest('#ytdlp-submit');
        if (submitBtn) {
            if (submitBtn.disabled) return;
            
            const isScheduled = document.getElementById('ytdlp-is-scheduled').checked;
            const scheduleTime = document.getElementById('ytdlp-schedule-time').value;
            
            if (isScheduled && !scheduleTime) {
                alert('⚠️ يرجى تحديد وقت الجدولة أولاً!');
                return;
            }

            submitBtn.disabled = true;
            const quality = document.getElementById('ytdlp-quality').value;
            const startT = document.getElementById('ytdlp-start').value.trim();
            const endT = document.getElementById('ytdlp-end').value.trim();
            const isPlaylist = document.getElementById('ytdlp-is-playlist').checked;
            const hasSubs = document.getElementById('ytdlp-subtitles').checked;
            const msgBox = document.getElementById('ytdlp-msg');

            submitBtn.innerText = 'جاري الإرسال... ⏳';

            let finalUrl = window.location.href;
            if (!isPlaylist && finalUrl.includes('/watch')) {
                try {
                    let urlObj = new URL(finalUrl);
                    urlObj.searchParams.delete('list'); urlObj.searchParams.delete('index'); urlObj.searchParams.delete('start_radio');
                    finalUrl = urlObj.toString();
                } catch(err) {}
            }
            
            const payload = { url: finalUrl, mode: quality, subtitles: hasSubs };
            if (startT && endT) { payload.start_time = startT; payload.end_time = endT; }
            if (isScheduled && scheduleTime) { payload.schedule_time = scheduleTime; }

            try {
                let res = await fetch(SERVER_URL + '/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.status === 400) {
                    submitBtn.innerText = '⚠️ مضاف بالفعل!'; submitBtn.style.background = '#f9e2af'; submitBtn.style.color = '#11111b';
                } else if(res.ok) {
                    submitBtn.innerText = isScheduled ? 'تمت الجدولة! ⏰' : 'بدأ التحميل! ✅'; 
                    submitBtn.style.background = '#a6e3a1'; submitBtn.style.color = '#11111b';
                }
            } catch (err) {
                submitBtn.innerText = 'السيرفر مغلق! ❌'; submitBtn.style.background = '#f38ba8';
            } finally {
                setTimeout(() => { 
                    if (!currentStatus || !['queued', 'downloading', 'downloading audio', 'converting', 'cancelled', 'scheduled'].includes(currentStatus)) {
                        submitBtn.disabled = false; 
                        submitBtn.innerText = 'ابدأ التحميل 🚀';
                        submitBtn.style.background = 'linear-gradient(135deg, #a6e3a1, #94e2d5)';
                    }
                }, 2500);
            }
        }

        const actionBtn = e.target.closest('.ytdlp-action-btn');
        if (actionBtn) {
            if(actionBtn.disabled) return;
            actionBtn.disabled = true;
            actionBtn.innerHTML = '⏳'; 
            
            const id = actionBtn.dataset.id;
            const action = actionBtn.dataset.action;
            try {
                if (action === 'pause') await fetch(`${SERVER_URL}/download/${id}`, { method: 'DELETE' });
                else if (action === 'resume') await fetch(`${SERVER_URL}/resume/${id}`, { method: 'POST' });
                else if (action === 'remove') await fetch(`${SERVER_URL}/remove/${id}`, { method: 'DELETE' });
            } catch(err) {}
        }
        
        if (e.target.id === 'ytdlp-clear-btn') {
            try { await fetch(`${SERVER_URL}/queue/completed`, { method: 'DELETE' }); } catch(err) {}
        }
    });
}

setInterval(async () => {
    try {
        let res = await fetch(SERVER_URL + '/queue');
        if(!res.ok) return;
        let data = await res.json();
        
        const keys = Object.keys(data);
        const activeCount = keys.filter(k =>['queued', 'downloading', 'downloading audio', 'converting', 'cancelled', 'scheduled'].includes(data[k].status)).length;
        
        let currentId = extractVidId(window.location.href);
        let activeDl = null;
        if (currentId) {
            activeDl = Object.values(data).find(d => extractVidId(d.url) === currentId);
        }

        if (activeDl) currentStatus = activeDl.status; else currentStatus = null;

        const ballText = document.getElementById('ytdlp-ball-text');
        const morphBox = document.getElementById('ytdlp-morph-box');
        const submitBtn = document.getElementById('ytdlp-submit');
        
        if (ballText && morphBox) {
            if (activeDl) {
                if(activeDl.status === 'downloading') {
                    ballText.innerHTML = `${Math.round(activeDl.progress)}%`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #f9e2af, #f5c2e7)';
                    ballText.style.color = '#11111b';
                } else if(activeDl.status === 'downloading audio') {
                    ballText.innerHTML = `🎵`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #89b4fa, #cba6f7)';
                    ballText.style.color = '#fff';
                } else if(activeDl.status === 'converting') {
                    ballText.innerHTML = `🔄`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #cba6f7, #89b4fa)';
                    ballText.style.color = '#fff';
                } else if(activeDl.status === 'completed') {
                    ballText.innerHTML = `✅`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #a6e3a1, #94e2d5)';
                    ballText.style.color = '#11111b';
                } else if(activeDl.status === 'cancelled') {
                    ballText.innerHTML = `⏸️`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #f38ba8, #eba0ac)';
                    ballText.style.color = '#11111b';
                } else if(activeDl.status === 'scheduled') {
                    ballText.innerHTML = `⏰`;
                    if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #cba6f7, #b4befe)';
                    ballText.style.color = '#11111b';
                }
            } else {
                ballText.innerHTML = '⬇️';
                if(!isExpanded) morphBox.style.background = 'linear-gradient(135deg, #007bff, #00d2ff)';
                ballText.style.color = 'white';
            }

            let badge = document.getElementById('ytdlp-badge');
            if (badge) {
                if (activeCount > 0) {
                    badge.style.display = 'flex';
                    if (lastBadgeCount !== activeCount) {
                        badge.innerText = activeCount;
                        badge.classList.remove('badge-pop', 'badge-decrease');
                        void badge.offsetWidth; 
                        
                        if (lastBadgeCount !== -1 && activeCount < lastBadgeCount) {
                            badge.classList.add('badge-decrease');
                        } else {
                            badge.classList.add('badge-pop');
                        }
                        lastBadgeCount = activeCount;
                    }
                } else {
                    if (lastBadgeCount > 0) {
                        badge.classList.remove('badge-pop', 'badge-decrease');
                        void badge.offsetWidth;
                        badge.classList.add('badge-decrease');
                        setTimeout(() => badge.style.display = 'none', 300);
                        lastBadgeCount = 0;
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        }

        if (submitBtn && submitBtn.innerText !== 'جاري الإرسال... ⏳' && submitBtn.innerText !== '⚠️ مضاف بالفعل!' && submitBtn.innerText !== 'بدأ التحميل! ✅' && submitBtn.innerText !== 'تمت الجدولة! ⏰') {
            if (currentStatus &&['queued', 'downloading', 'downloading audio', 'converting', 'cancelled', 'scheduled'].includes(currentStatus)) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'الطلب موجود بالقائمة بالفعل ⏳';
                submitBtn.style.background = '#45475a';
                submitBtn.style.color = '#cdd6f4';
            } else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'ابدأ التحميل 🚀';
                submitBtn.style.background = 'linear-gradient(135deg, #a6e3a1, #94e2d5)';
                submitBtn.style.color = '#11111b';
            }
        }

        const queueContainer = document.getElementById('ytdlp-queue-section');
        if (queueContainer) {
            if (keys.length === 0) {
                queueContainer.innerHTML = '<div style="text-align:center; color:#a6adc8; font-size:12px; margin-top:20px;">لا يوجد تحميلات حالياً 😴</div>';
            } else {
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
                    else if(statusText === 'scheduled') { statusText = `مجدول (${item.schedule_time}) ⏰`; color = '#b4befe'; }

                    const isPlaylist = item.url.includes('list=') ? '📑' : '🎬';

                    let actionButtons = '';
                    if (['downloading', 'downloading audio', 'queued', 'converting'].includes(item.status)) {
                        actionButtons = `<button class="ytdlp-action-btn" data-id="${id}" data-action="pause" title="إيقاف مؤقت">⏸️</button>`;
                    } else if (['cancelled', 'failed', 'scheduled'].includes(item.status)) {
                        actionButtons = `<button class="ytdlp-action-btn" data-id="${id}" data-action="resume" title="استئناف / بدء فوراً">▶️</button>`;
                    }
                    actionButtons += `<button class="ytdlp-action-btn" data-id="${id}" data-action="remove" title="حذف">❌</button>`;

                    html += `
                    <div class="ytdlp-dl-item">
                        <div class="ytdlp-btn-group">${actionButtons}</div>
                        <div class="ytdlp-dl-title" title="${item.title}">${isPlaylist} ${item.title}</div>
                        <div class="ytdlp-dl-info">
                            <span class="ytdlp-status" style="background:${color}">${statusText}</span>
                            <span>${item.speed} | وقت: ${item.eta}</span>
                            <span style="font-weight:bold; color:${color};">${item.progress}%</span>
                        </div>
                        <div class="ytdlp-progress-bg">
                            <div class="ytdlp-progress-fill" style="width: ${item.progress}%; background: ${color};"></div>
                        </div>
                    </div>`;
                });
                queueContainer.innerHTML = html;
            }
        }
    } catch(e) {}
}, 200);

document.addEventListener('yt-navigate-finish', injectUI);
if(document.body) injectUI(); else document.addEventListener('DOMContentLoaded', injectUI);