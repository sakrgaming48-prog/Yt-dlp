// Background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ YT-dlp Helper Pro installed successfully!");
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_STARTED') {
    showChromeNotification(message.url, message.mode);
  }
  
  if (message.type === 'DOWNLOAD_COMPLETED') {
    showCompletionNotification(message.title);
  }
  
  if (message.type === 'DOWNLOAD_FAILED') {
    showErrorNotification(message.error);
  }
  
  if (message.type === 'OPEN_FOLDER') {
    openDownloadFolder();
  }
});

// Show download started notification
function showChromeNotification(url, mode) {
  const modeText = getModeText(mode);
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="%23667eea"/><text x="64" y="80" font-size="60" text-anchor="middle" fill="white">⬇️</text></svg>',
    title: '🚀 بدأ التحميل',
    message: `جودة: ${modeText}\nجاري تحميل الفيديو...`,
    priority: 1
  });
}

// Show completion notification
function showCompletionNotification(title) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="%234ade80"/><text x="64" y="80" font-size="60" text-anchor="middle" fill="white">✓</text></svg>',
    title: '✅ اكتمل التحميل',
    message: title || 'تم تحميل الفيديو بنجاح!',
    priority: 2
  });
}

// Show error notification
function showErrorNotification(error) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="%23ff4444"/><text x="64" y="80" font-size="60" text-anchor="middle" fill="white">✗</text></svg>',
    title: '❌ فشل التحميل',
    message: error || 'حدث خطأ أثناء التحميل',
    priority: 2
  });
}

// Open download folder
function openDownloadFolder() {
  // Note: Chrome extensions can't directly open local folders
  // This is a workaround using chrome.downloads API
  
  chrome.downloads.showDefaultFolder();
  
  // Alternative: Could use native messaging to open specific folder
  // But that requires additional setup
}

// Get mode text
function getModeText(mode) {
  const modes = {
    'video1080': '1080p HD',
    'video720': '720p',
    'video480': '480p',
    'video240': '240p',
    'audio': 'صوت MP3',
    'playlist1080': 'قائمة 1080p',
    'playlist720': 'قائمة 720p',
    'playlist480': 'قائمة 480p',
    'playlist240': 'قائمة 240p',
    'playlist_audio': 'قائمة صوت'
  };
  return modes[mode] || mode;
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Could open downloads page or folder
  console.log('Notification clicked:', notificationId);
});