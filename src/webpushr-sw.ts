import { UrlUtils_build } from "./utils/url";

declare let __COMMIT_HASH__: string;
const cacheName = `workoutthing-sw-${__COMMIT_HASH__}`;
const appShellCacheKey = "/app/index.html";

const filesToCache = [
  `/app.css?version=${__COMMIT_HASH__}`,
  `/app.js?version=${__COMMIT_HASH__}`,
  `/vendors.js?vendor=${__COMMIT_HASH__}`,
  `/images/back-muscles.svg`,
  `/images/front-muscles.svg`,
  `/images/svgs/muscles-combined.svg`,
  `/images/svgs/musclegroups-combined.svg`,
  /\/fonts\/.*/,
  /\/externalimages\/exercises\//,
  appShellCacheKey,
  "/icons/icon192.png",
  "/icons/icon512.png",
  "/icons/maskable_icon_512.png",
  "/notification.m4r",
];

function cacheRequest(request: RequestInfo, response: Response): Promise<Response> {
  return caches.open(cacheName).then((cache) => {
    console.log("[Service Worker] Caching new resource: " + request.toString());

    cache.put(request, response.clone());
    return response;
  });
}

function isAppShellPath(pathname: string): boolean {
  return pathname === "/app" || pathname === "/app/" || pathname === appShellCacheKey;
}

function initialize(service: ServiceWorkerGlobalScope): void {
  service.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(cacheName).then((cache) => {
        return Promise.all(
          (filesToCache.filter((f) => typeof f === "string") as string[]).map((file) => {
            return cache.add(file).catch((err) => {
              console.warn("[Service Worker] Failed to cache " + file, err);
            });
          })
        );
      })
    );
  });

  service.addEventListener("fetch", (e) => {
    const url = UrlUtils_build(e.request.url);
    if (e.request.method === "GET" && isAppShellPath(url.pathname)) {
      console.log("[Service Worker] Fetching " + e.request.url);
      e.respondWith(
        caches.match(appShellCacheKey).then((r) => {
          return fetch(e.request)
            .then((response) => cacheRequest(appShellCacheKey, response))
            .catch((err) => {
              if (r != null) {
                console.log("[Service Worker] Can't fetch, so using cache for: " + e.request.url);
                console.error(err);
                return r;
              } else {
                throw e;
              }
            });
        })
      );
    } else {
      console.log("[Service Worker] Checking the resource in cache: " + e.request.url);

      e.respondWith(
        caches.match(e.request).then((r) => {
          if (r) {
            console.log("[Service Worker] Returning from cache: " + e.request.url);
            return r;
          } else {
            console.log("[Service Worker] Missing from cache, fetching resource: " + e.request.url);
            return fetch(e.request).then((response) => {
              if (
                e.request.method === "GET" &&
                filesToCache.some((f) => {
                  if (typeof f === "string") {
                    const u = UrlUtils_build(e.request.url);
                    return `${u.pathname}${u.search}` === f;
                  } else {
                    const u = UrlUtils_build(e.request.url);
                    return f.test(`${u.pathname}${u.search}`);
                  }
                })
              ) {
                return cacheRequest(e.request, response);
              } else {
                return response;
              }
            });
          }
        })
      );
    }
  });

  self.addEventListener("activate", async (event: object) => {
    console.log("Activate Service Worker", event);
    const keys = (await caches.keys()).filter((k) => k !== cacheName);
    console.log(keys);
    for (const key of keys) {
      await caches.delete(key);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
initialize(self as any);
