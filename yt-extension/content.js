(function() {
  const SERVER = 'http://127.0.0.1:8765';
  let menuVisible = false;

  // Create floating button and menu
  function createDownloadUI() {
    if (document.getElementById('yt-dl-menu-container')) return;

    // Container
    const container = document.createElement('div');
    container.id = 'yt-dl-menu-container';
    
    // Main button
    const mainBtn = document.createElement('button');
    mainBtn.id = 'yt-dl-main-btn';
    mainBtn.innerHTML = '⬇️';
    mainBtn.title = 'تحميل سريع';
    
    // Menu
    const menu = document.createElement('div');
    menu.id = 'yt-dl-menu';
    menu.innerHTML = `
      <div class="menu-section">
        <div class="menu-label">🎬 فيديو</div>
        <div class="menu-item" data-mode="video1080">
          <span class="icon">🎬</span>
          <span>1080p HD</span>
        </div>
        <div class="menu-item" data-mode="video720">
          <span class="icon">📺</span>
          <span>720p</span>
        </div>
        <div class="menu-item" data-mode="video480">
          <span class="icon">📱</span>
          <span>480p</span>
        </div>
      </div>
      
      <div class="menu-section">
        <div class="menu-label">🎵 صوت</div>
        <div class="menu-item" data-mode="audio">
          <span class="icon">🎵</span>
          <span>MP3 Audio</span>
        </div>
      </div>
      
      <div class="menu-section">
        <div class="menu-label">📋 قائمة تشغيل</div>
        <div class="menu-item" data-mode="playlist720">
          <span class="icon">📚</span>
          <span>Playlist 720p</span>
        </div>
        <div class="menu-item" data-mode="playlist_audio">
          <span class="icon">🎼</span>
          <span>Playlist Audio</span>
        </div>
      </div>
    `;

    // Notification element
    const notification = document.createElement('div');
    notification.id = 'yt-dl-notification';

    // Assemble
    container.appendChild(mainBtn);
    container.appendChild(menu);
    document.body.appendChild(container);
    document.body.appendChild(notification);

    // Event listeners
    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // Menu item clicks
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = item.dataset.mode;
        startDownload(mode);
        hideMenu();
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        hideMenu();
      }
    });
  }

  // Toggle menu
  function toggleMenu() {
    const menu = document.getElementById('yt-dl-menu');
    menuVisible = !menuVisible;
    
    if (menuVisible) {
      menu.classList.add('active');
    } else {
      menu.classList.remove('active');
    }
  }

  // Hide menu
  function hideMenu() {
    const menu = document.getElementById('yt-dl-menu');
    menu.classList.remove('active');
    menuVisible = false;
  }

  // Start download
  async function startDownload(mode) {
    const url = window.location.href;
    
    // Show loading notification
    showNotification('⏳ جاري بدء التحميل...', 'info');

    try {
      const resp = await fetch(SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, mode: mode })
      });

      const data = await resp.json();

      if (data.status === 'ok') {
        showNotification('✅ بدأ التحميل بنجاح!', 'success');
        
        // Send message to background for Chrome notification
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_STARTED',
          url: url,
          mode: mode
        });
      } else {
        showNotification('❌ خطأ: ' + data.msg, 'error');
      }
    } catch (e) {
      showNotification('❌ السيرفر مش شغال! شغله الأول', 'error');
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notif = document.getElementById('yt-dl-notification');
    
    // Set content
    notif.innerHTML = `
      <div class="notification-title">${getNotificationTitle(type)}</div>
      <div class="notification-message">${message}</div>
    `;
    
    // Set class
    notif.className = 'notification-' + type;
    
    // Show
    setTimeout(() => notif.classList.add('show'), 10);
    
    // Hide after 4 seconds
    setTimeout(() => {
      notif.classList.remove('show');
    }, 4000);
  }

  // Get notification title
  function getNotificationTitle(type) {
    const titles = {
      'success': '✅ نجح التحميل',
      'error': '❌ حدث خطأ',
      'info': 'ℹ️ معلومة'
    };
    return titles[type] || 'إشعار';
  }

  // Initialize
  function init() {
    createDownloadUI();
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run for YouTube's dynamic navigation
  document.addEventListener('yt-navigate-finish', init);
  
  // Backup: re-check after delay
  setTimeout(init, 2000);
})();