const SERVER = 'http://127.0.0.1:8765';
let notified = new Set();
const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

setInterval(async () => {
    try {
        let res = await fetch(`${SERVER}/queue`);
        if (!res.ok) return;
        let data = await res.json();
        
        for (let id in data) {
            let item = data[id];
            // لو اكتمل ومبعتناش إشعار قبل كده
            if (item.status === 'completed' && !notified.has(id)) {
                chrome.notifications.create(`dl_${id}`, {
                    type: 'basic', iconUrl: iconData,
                    title: '✅ اكتمل التحميل!', message: item.title, priority: 2
                });
                notified.add(id);
            } 
            // لو فشل
            else if (item.status === 'failed' && !notified.has(id)) {
                chrome.notifications.create(`dl_${id}_fail`, {
                    type: 'basic', iconUrl: iconData,
                    title: '❌ فشل التحميل', message: item.title, priority: 2
                });
                notified.add(id);
            }
        }
        
        // تنظيف الذاكرة للملفات اللي اتمسحت من القائمة
        for (let id of notified) {
            if (!data[id]) notified.delete(id);
        }
    } catch(e) {}
}, 3000);