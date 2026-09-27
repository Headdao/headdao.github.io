// happy-branch-web service worker
// 版本化資產（index.<v>.js/.wasm/.pck）只增不刪（deploy_web.sh 原則）→
// cache-first 永久快取；index.html 與導覽請求 network-first（部署新版本後
// 要立刻拿到新 HTML，失敗時退回快取頁面）。
// 效果：同一版本重載不再受 GitHub Pages 10 分鐘快取限制／無痕模式重抓
// 25MB——只有換版本才會下載新資產。
const CACHE = 'happy-branch-v1';
// 版號資產含音訊 worklet（deploy_web.sh 同步版號化——2026-09-28 前未版號化，
// 引擎以 executable 前綴抓 worklet 404，網頁版全程無聲）。
const VERSIONED = /index\.\d+\.(audio\.position\.worklet\.js|audio\.worklet\.js|js|wasm|pck)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    return;
  }
  const path = url.pathname;
  const isPage = path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('.html');
  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  if (VERSIONED.test(path)) {
    // 版號資產只增不刪 → 永久快取
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }
  // 其他無版號資產（sw.js 以外的靜態檔）→ network-first：改版要能被看到
  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request))
  );
});
