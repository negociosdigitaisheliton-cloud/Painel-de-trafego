/* Service worker do Painel de Tráfego.
   Objetivo: deixar o painel instalável na tela de início e abrir rápido,
   sem nunca servir uma versão velha do app nem tocar nas chamadas do Supabase. */

const VERSAO = "painel-v1";
const CASCA = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => Promise.allSettled(CASCA.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;

  // só GET, só mesmo domínio: Supabase, fontes e afins passam direto pela rede
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__manus/")) return;

  // navegação: rede primeiro, cache só como rede de segurança (offline)
  if (pedido.mode === "navigate") {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put("/index.html", copia)).catch(() => {});
          return resposta;
        })
        .catch(() => caches.match("/index.html").then((cacheado) => cacheado || caches.match("/"))),
    );
    return;
  }

  // estáticos com hash no nome: cache primeiro, revalidando em segundo plano
  const estatico = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
  if (!estatico) return;

  evento.respondWith(
    caches.match(pedido).then((cacheado) => {
      const rede = fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia)).catch(() => {});
          }
          return resposta;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    }),
  );
});
