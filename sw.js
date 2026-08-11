// アプリの外枠（HTML・JS・CSS・アイコン）をキャッシュするサービスワーカー。
// 家計簿のデータ自体は Google のサーバから取るのでキャッシュしない。
//
// 目的は主に2つ:
//   - ホーム画面に追加したとき、単体アプリとして扱ってもらう（Android の条件を満たす）
//   - 起動を速くする（毎回ネットワークを待たない）
//
// デプロイのたびに CACHE_VERSION を上げること。上げ忘れても index.html は
// 毎回ネットワークを見に行くので新しい JS を読むが、古いキャッシュは残り続ける。

const CACHE_VERSION = 'v1';
const CACHE_NAME = `kakeibo-shell-${CACHE_VERSION}`;

self.addEventListener('install', () => {
  // 新しい内容をすぐ使わせる（待機状態で止めない）
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 自分のオリジンの GET だけを扱う。Google API への通信には一切触らない
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // 画面遷移（HTML）は常に新しいものを優先する。古い画面を掴んだままにしないため
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // /assets/ 配下はファイル名にハッシュが入っていて中身が変わらないので、キャッシュを優先する
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // エラー応答や不透明な応答は残さない
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
