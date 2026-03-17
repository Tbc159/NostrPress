(async () => {
  // --- PARTE 1: Utility per i link esterni
  console.log("[NostrPress] Client-side script avviato");

  // Funzione per convertire npub in HEX (utilizza la libreria nostr-tools)

  // Logica simile a resolveIdentity di client.js
  const getPubkeyHex = (input) => {
    try {
      if (!input) return null;
      
      // Se è già un HEX (64 caratteri)
      if (/^[0-9a-fA-F]{64}$/.test(input)) {
        return input;
      }

      // Se è un npub, usa la logica di nip19 (come nel tuo client.js)
      if (input.startsWith('npub')) {
        const decoded = window.NostrTools.nip19.decode(input);
        console.log("[NostrPress] NPUB decodificato con successo");
        return decoded.data;
      }
      
      return null;
    } catch (e) {
      console.error("[NostrPress] Errore nel processare l'identità:", e);
      return null;
    }
  };

  const handleExternalLinks = () => {
    const links = document.querySelectorAll("a");
    console.log(`🔗 [NostrPress] Gestione link esterni per ${links.length} elementi`);
    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http")) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });
  };

  // --- PARTE 2: Caricamento dinamico da Nostr
  const loadNostrContent = async () => {
    // Cerchiamo il contenitore dove iniettare i post
    const container = document.getElementById('articles-container');
    if (!container) return;

    // Recupera la NPUB che abbiamo iniettato nel layout
    const npubFromEnv = window.NOSTR_CONFIG?.npub;
    console.log("[NostrPress] NPUB recuperata dall'ambiente:", npubFromEnv);

    const pubkey = getPubkeyHex(npubFromEnv);
    const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];

    if (!pubkey) {
      console.error("[NostrPress] Pubkey non valida o mancante. Controlla la variabile NPUB su Netlify.");
      container.innerHTML = "<p>Errore di configurazione: NPUB non trovata.</p>";
      return;
    }

    try {
      if (!window.NostrTools) {
        throw new Error("Libreria NostrTools non caricata correttamente.");
      }

      console.log("[NostrPress] Connessione ai relay in corso...");
      const pool = new window.NostrTools.SimplePool();
      
      // Recuperiamo gli articoli (Kind 30023)
      console.log(`[NostrPress] Fetching articoli per pubkey: ${pubkey}...`);

      // Filtro identico a quello di fetchArticles in client.js
      const filter = {
        authors: [pubkey],
        kinds: [30023],
        limit: 10
      };

      const events = await pool.querySync(relays, filter);
      console.log(`[NostrPress] Eventi ricevuti: ${events.length}`);

      if (events.length === 0) {
        container.innerHTML = "<p>Nessun articolo trovato.</p>";
        return;
      }

      // Ordina per data (come nel tuo sistema di build)
      const articles = events.sort((a, b) => b.created_at - a.created_at);

      container.innerHTML = '';
      articles.forEach(article => {
        const title = article.tags.find(t => t[0] === 'title')?.[1] || "Senza titolo";
        const summary = article.tags.find(t => t[0] === 'summary')?.[1] || article.content.substring(0, 150) + "...";
        const slug = article.tags.find(t => t[0] === 'd')?.[1];
        const image = article.tags.find(t => t[0] === 'image')?.[1] || null;
        const date = new Date(article.created_at * 1000).toISOString().split('T')[0];

        container.insertAdjacentHTML('beforeend', `
          <article class="group relative flex flex-col">
            <a href="/${slug}.html" class="flex flex-col h-full">
              <div class="relative rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-500 ease-out hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 flex flex-col h-full">
                ${image ? `
                <div class="relative h-48 overflow-hidden flex-shrink-0">
                  <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10"></div>
                  <img src="${image}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                </div>` : ''}
                <div class="relative p-6 space-y-3 flex-1 flex flex-col">
                  <div class="flex items-center gap-2 text-xs">
                    <time class="font-medium text-slate-500">${date}</time>
                  </div>
                  <h3 class="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2">${title}</h3>
                  <p class="text-sm text-slate-600 leading-relaxed line-clamp-3 flex-1">${summary}</p>
                </div>
              </div>
            </a>
          </article>
        `);
      });

    } catch (err) {
      console.error("[NostrPress] Errore durante il caricamento:", err);
      container.innerHTML = "<p>Errore nel caricamento dei contenuti live.</p>";
    }
  };

  await loadNostrContent();
})();