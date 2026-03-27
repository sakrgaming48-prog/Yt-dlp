const SERVER = "http://127.0.0.1:8765";
let selectedMode = "video720";
let queueRefreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkServer();
  loadYtdlpVersion();
  setupEventListeners();
  autoFillCurrentURL();
  
  // Check server status every 5 seconds
  setInterval(checkServer, 5000);
});

// Setup Event Listeners
function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  // Quality buttons (single download)
  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMode = btn.dataset.mode;
    });
  });

  // Single download button
  document.getElementById('downloadBtn').addEventListener('click', startSingleDownload);
  
  // Batch download button
  document.getElementById('batchDownloadBtn').addEventListener('click', startBatchDownload);
  
  // Batch URL counter
  document.getElementById('batchUrls').addEventListener('input', updateBatchCount);
  
  // Queue actions
  document.getElementById('refreshQueue').addEventListener('click', refreshQueue);
  document.getElementById('openFolder').addEventListener('click', openFolder);
  document.getElementById('clearCompleted').addEventListener('click', clearCompleted);
  
  // Update yt-dlp
  document.getElementById('updateYtdlp').addEventListener('click', updateYtdlp);
  
  // Enter key shortcuts
  document.getElementById('url').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startSingleDownload();
  });
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Start queue refresh if on queue tab
  if (tabName === 'queue') {
    refreshQueue();
    queueRefreshInterval = setInterval(refreshQueue, 2000);
  } else {
    if (queueRefreshInterval) {
      clearInterval(queueRefreshInterval);
      queueRefreshInterval = null;
    }
  }
}

// Check Server Status
async function checkServer() {
  const statusDot = document.getElementById('serverStatus');
  const statusText = document.getElementById('serverText');
  
  try {
    const resp = await fetch(SERVER, { method: "OPTIONS" });
    statusDot.classList.add('online');
    statusText.textContent = "السيرفر شغال ✓";
  } catch (e) {
    statusDot.classList.remove('online');
    statusText.textContent = "السيرفر مطفي ✗";
  }
}

// Auto-fill current tab URL
async function autoFillCurrentURL() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'))) {
      document.getElementById('url').value = tab.url;
    }
  } catch (e) {
    console.log('Could not get current tab URL');
  }
}

// Update batch count
function updateBatchCount() {
  const urls = document.getElementById('batchUrls').value.trim().split('\n');
  const validUrls = urls.filter(u => u.trim().length > 0);
  document.getElementById('batchCount').textContent = validUrls.length;
}

// Start Single Download
async function startSingleDownload() {
  const url = document.getElementById('url').value.trim();
  const mode = selectedMode;

  if (!url) {
    showNotification('⚠️ الصق رابط الفيديو الأول', 'error');
    return;
  }

  try {
    const resp = await fetch(SERVER + '/download', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, mode: mode })
    });

    const data = await resp.json();

    if (data.status === 'ok') {
      showNotification('✅ بدأ التحميل!', 'success');
      
      // Switch to queue tab
      switchTab('queue');
      
      // Send notification to background
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_STARTED',
        url: url,
        mode: mode
      });
    } else {
      throw new Error(data.msg || 'Unknown error');
    }
  } catch (e) {
    showNotification('❌ السيرفر مش شغال! شغله الأول', 'error');
  }
}

// Start Batch Download
async function startBatchDownload() {
  const urlsText = document.getElementById('batchUrls').value.trim();
  const mode = document.getElementById('batchMode').value;
  
  if (!urlsText) {
    showNotification('⚠️ الصق روابط الفيديوهات الأول', 'error');
    return;
  }
  
  const urls = urlsText.split('\n').filter(u => u.trim().length > 0);
  
  if (urls.length === 0) {
    showNotification('⚠️ لا توجد روابط صالحة', 'error');
    return;
  }
  
  try {
    const resp = await fetch(SERVER + '/download', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urls, mode: mode })
    });

    const data = await resp.json();

    if (data.status === 'ok') {
      showNotification(`✅ بدأ تحميل ${urls.length} فيديو!`, 'success');
      
      // Switch to queue tab
      switchTab('queue');
      
      // Clear batch input
      document.getElementById('batchUrls').value = '';
      updateBatchCount();
    } else {
      throw new Error(data.msg || 'Unknown error');
    }
  } catch (e) {
    showNotification('❌ السيرفر مش شغال! شغله الأول', 'error');
  }
}

// Refresh Queue
async function refreshQueue() {
  try {
    const resp = await fetch(SERVER + '/queue');
    const data = await resp.json();
    
    if (data.status === 'ok') {
      renderQueue(data.downloads);
      updateActiveCount(data.downloads);
    }
  } catch (e) {
    console.log('Failed to refresh queue:', e);
  }
}

// Render Queue
function renderQueue(downloads) {
  const queueList = document.getElementById('queueList');
  const downloadArray = Object.values(downloads);
  
  if (downloadArray.length === 0) {
    queueList.innerHTML = '<div class="empty-state">لا توجد تحميلات جارية</div>';
    return;
  }
  
  // Sort by ID (newest first)
  downloadArray.sort((a, b) => b.id.localeCompare(a.id));
  
  queueList.innerHTML = downloadArray.map(dl => {
    const statusIcon = getStatusIcon(dl.status);
    const statusClass = `status-${dl.status}`;
    
    return `
      <div class="queue-item">
        <div class="queue-title">${statusIcon} ${escapeHtml(dl.title)}</div>
        <div class="queue-status ${statusClass}">
          ${getStatusText(dl.status)}
          ${dl.error ? ' - ' + dl.error : ''}
        </div>
        ${dl.status === 'downloading' || dl.status === 'converting' ? `
          <div class="queue-progress">
            <div class="queue-progress-fill" style="width: ${dl.progress}%"></div>
          </div>
          <div class="queue-meta">
            <span>${Math.floor(dl.progress)}%</span>
            <span>${dl.speed || ''} ${dl.eta ? '• ' + dl.eta : ''}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Get status icon
function getStatusIcon(status) {
  const icons = {
    'queued': '⏳',
    'fetching info': '🔍',
    'downloading': '⬇️',
    'converting': '🔄',
    'completed': '✅',
    'failed': '❌'
  };
  return icons[status] || '📥';
}

// Get status text
function getStatusText(status) {
  const texts = {
    'queued': 'في الانتظار',
    'fetching info': 'جاري جلب المعلومات',
    'downloading': 'جاري التحميل',
    'converting': 'جاري التحويل',
    'completed': 'اكتمل',
    'failed': 'فشل'
  };
  return texts[status] || status;
}

// Update active downloads count
function updateActiveCount(downloads) {
  const downloadArray = Object.values(downloads);
  const activeCount = downloadArray.filter(d => 
    d.status === 'downloading' || d.status === 'queued' || d.status === 'converting'
  ).length;
  
  document.getElementById('activeDownloads').textContent = 
    activeCount > 0 ? `${activeCount} جاري` : '0 تحميل';
}

// Open download folder
function openFolder() {
  // Send message to background to open folder
  chrome.runtime.sendMessage({ type: 'OPEN_FOLDER' });
  showNotification('📂 فتح المجلد...', 'info');
}

// Clear completed downloads
async function clearCompleted() {
  try {
    const resp = await fetch(SERVER + '/queue/completed', {
      method: 'DELETE'
    });
    
    const data = await resp.json();
    
    if (data.status === 'ok') {
      showNotification('🗑️ تم مسح التحميلات المكتملة', 'success');
      refreshQueue();
    }
  } catch (e) {
    showNotification('❌ فشل المسح', 'error');
  }
}

// Load yt-dlp version
async function loadYtdlpVersion() {
  try {
    const resp = await fetch(SERVER + '/check-update');
    const data = await resp.json();
    if (data.status === 'ok') {
      document.getElementById('ytdlpVersion').textContent = `v${data.version}`;
    }
  } catch (e) {
    document.getElementById('ytdlpVersion').textContent = '';
  }
}

// Update yt-dlp
async function updateYtdlp() {
  const btn = document.getElementById('updateYtdlp');
  btn.disabled = true;
  btn.textContent = '⏳ جاري التحديث...';
  
  try {
    const resp = await fetch(SERVER + '/update-ytdlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await resp.json();
    
    if (data.status === 'ok') {
      showNotification('✅ جاري تحديث yt-dlp...', 'success');
      
      // Wait a bit then reload version
      setTimeout(() => {
        loadYtdlpVersion();
        btn.disabled = false;
        btn.textContent = '⬆️ تحديث yt-dlp';
      }, 5000);
    }
  } catch (e) {
    showNotification('❌ فشل التحديث', 'error');
    btn.disabled = false;
    btn.textContent = '⬆️ تحديث yt-dlp';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4ade80' : type === 'error' ? '#ff4444' : '#667eea'};
    color: white;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: slideDown 0.3s ease;
  `;
  notif.textContent = message;
  
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { transform: translate(-50%, -100%); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, -100%); opacity: 0; }
  }
`;
document.head.appendChild(style);