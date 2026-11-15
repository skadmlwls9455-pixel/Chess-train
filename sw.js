// 앱 설치용 서비스 워커. 캐시는 하지 않고 그대로 네트워크로 보낸다
// (배포하면 바로 새 버전이 보이게).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
